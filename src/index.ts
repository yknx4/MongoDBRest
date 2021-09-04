import { sentry } from './sentry'
import { badRequest, notFound } from '@hapi/boom'
import Hapi from '@hapi/hapi'
import { Filter, ObjectId, Document, FindCursor, SortDirection } from 'mongodb'
import { mongoClient } from './mongo'
import invariant from 'invariant'
import { config } from './config'
import { HealthPlugin } from 'hapi-k8s-health'
// @ts-expect-error
import laabr from 'laabr'
// @ts-expect-error
import Brok from 'brok'

interface CollectionQueryParams {
  collection: string
  query?: Filter<Document>
  sort?: [string, SortDirection]
  last?: ObjectId
  limit: number
}

function validateParams (params: Hapi.Util.Dictionary<any>): CollectionQueryParams {
  const result: Partial<CollectionQueryParams> = {}
  invariant(typeof params.collection === 'string', 'collection must be string')
  result.collection = params.collection
  if (typeof params.query === 'string') {
    result.query = JSON.parse(params.query)
  }
  if (typeof params.sort === 'string') {
    result.sort = JSON.parse(params.sort)
    invariant(Array.isArray(result.sort), 'sort must be an array')
    invariant(result.sort.length === 2, 'we only support single field sort in the format [string, SortDirection]')
  }
  if (typeof params.last === 'string') {
    result.last = new ObjectId(params.last)
  }

  if (typeof params.limit === 'string') {
    result.limit = Number(params.limit)
  }

  if (result.limit === undefined || result.limit > 100) {
    result.limit = 100
  }

  return result as CollectionQueryParams
}

const init = async (): Promise<void> => {
  const server = Hapi.server({
    port: config.port,
    host: config.host,
    compression: { minBytes: 1024 * 128 }
  })
  const mongo = mongoClient
  server.route({
    method: 'GET',
    path: '/collections',
    handler: async (request, h) => {
      const db = mongo.db()

      const collectionInfo = await db.listCollections().toArray()

      const response = h.response(collectionInfo)

      return response
    }
  })
  server.route({
    method: 'GET',
    path: '/collections/{collection}/{id}',
    handler: async (request, h) => {
      const { collection, id } = request.params
      if (typeof collection !== 'string' && typeof id !== 'string') {
        return badRequest('invalid params', { params: request.params })
      }

      const db = mongo.db()

      const collectionInfo = await db.listCollections({ name: collection }).next()
      if (collectionInfo === null) {
        return notFound('collection not found', { collection })
      }

      const object = await db.collection(collection, { readPreference: 'secondaryPreferred' }).findOne({ _id: new ObjectId(id) })

      if (object === null) {
        return notFound('object not found', { collection, id })
      }

      const response = h.response(object)

      return response
    }
  })
  server.route({
    method: 'GET',
    path: '/collections/{collection}',
    handler: async (request, h) => {
      try {
        const { collection, query, sort, last, limit } = validateParams({ ...request.params, ...request.query })
        const db = mongo.db()

        const collectionInfo = await db.listCollections({ name: collection }).next()
        if (collectionInfo === null) {
          return notFound('collection not found', { collection })
        }
        const collectionQuery = db.collection(collection, { readPreference: 'secondaryPreferred' })
        let findQuery: FindCursor<Document>

        if (query !== undefined && sort !== undefined && last !== undefined) {
          const lastDocument = await collectionQuery.findOne({ _id: last })
          if (lastDocument === null) {
            return notFound('last item not found', { collection, last: request.params.last })
          }

          const sortField = sort[0]
          const sortOperator = sort[1] === 1 ? '$gt' : '$lt'
          const sortValue = lastDocument[sortField]
          if (sortValue == null) {
            return badRequest('Invalid sort field', { sort })
          }

          findQuery = collectionQuery.find({ $and: [{ _id: { [sortOperator]: last } }, { [sortField]: { [sortOperator]: sortValue } }] })
        } else if (query === undefined && sort === undefined && last !== undefined) {
          findQuery = collectionQuery.find({ _id: { $gt: last } })
        } else if (query !== undefined && sort === undefined && last !== undefined) {
          findQuery = collectionQuery.find({ ...query, _id: { $gt: last } })
        } else if (query !== undefined && sort !== undefined) {
          findQuery = collectionQuery.find(query).sort(sort)
        } else if (sort !== undefined) {
          findQuery = collectionQuery.find().sort(sort)
        } else {
          findQuery = collectionQuery.find()
        }

        const result = await findQuery.limit(limit).toArray()
        return h.response(result)
      } catch (error) {
        console.error(error)
        badRequest('invalid params', { params: request.params })
      }
    }
  })
  if (config.isProd) {
    await server.register({
      plugin: require('hapi-sentry'),
      options: {
        client: sentry
      }
    })
  }
  await server.register({
    plugin: laabr,
    options: {
      colored: !config.isProd,
      override: true,
      hapiPino: { logQueryParams: true, logRouteTags: true }
    }
  })
  await server.register({ plugin: require('hapi-x-request-id') })
  await server.register({
    plugin: Brok,
    options: {
      compress: { quality: 3 }
    }
  })

  await mongo.connect()
  await server.register({ plugin: require('blipp') })

  await server.register({
    plugin: HealthPlugin,
    options: {
      livenessProbes: {
        status: async () => {
          await mongo.db().command({ ping: 1 })
        }
      },
      readinessProbes: {
        mongodb: async () => { await mongo.db().command({ ping: 1 }) }
      }
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  await server.register(require('hapi-response-time'))

  await server.start()
  console.log('Server running on %s', server.info.uri)
}

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})

init().catch(e => {
  console.error(e)
  process.exit(1)
})
