/* eslint-env jest */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Server } from '@hapi/hapi'
import { last, shuffle, times } from 'lodash'
import { MongoClient, ObjectId, Document, InsertOneResult } from 'mongodb'
import { init } from './server'

describe('Server', () => {
  let server: Server
  let mongo: MongoClient
  let inputNumbers: number[]
  let dbDocuments: Array<InsertOneResult<Document>>

  beforeAll(async () => {
    mongo = new MongoClient('mongodb://admin:password@localhost:27017/rest_test?authSource=admin', { maxPoolSize: 5, minPoolSize: 1, loggerLevel: 'debug' })
    server = await init({ mongodbstring: 'mongodb://admin:password@localhost:27017/rest_test?authSource=admin' })
  })

  beforeEach(async () => {
    mongo = await mongo.connect()
    inputNumbers = shuffle(times(300))
    dbDocuments = []
    for (const i of inputNumbers) {
      dbDocuments.push(await mongo.db().collection('items').insertOne({ value: i }))
    }
  })

  afterEach(async () => {
    mongo = await mongo.connect()
    await mongo.db().dropDatabase()
  })

  afterAll(async () => {
    await mongo.close(true)
    await server.stop({ timeout: 500 })
  })

  describe('metadata', () => {
    it('gets all collections', async () => {
      const res = await server.inject({
        method: 'get',
        url: '/collections'
      })
      expect(res.statusCode).toEqual(200)
      const data = res.result as Array<{name: string}>
      expect(data.length).toEqual(1)
      expect(data[0].name).toEqual('items')
    })
  })

  describe('single item', () => {
    it('gets single item', async () => {
      const res = await server.inject({
        method: 'get',
        url: `/collections/items/${dbDocuments[0].insertedId.toHexString()}`
      })
      expect(res.statusCode).toEqual(200)
      const data = res.result as Document
      expect(data._id).toEqual(dbDocuments[0].insertedId)
    })
  })

  describe('collection', () => {
    it('get simple collection', async () => {
      const res = await server.inject({
        method: 'get',
        url: '/collections/items'
      })
      expect(res.statusCode).toEqual(200)
      const data = res.result as Array<{_id: string, value: number}>
      expect(data.length).toEqual(100)
    })

    it('get simple collection sorted', async () => {
      const res = await server.inject({
        method: 'get',
        url: '/collections/items?sort=["value",1]'
      })
      expect(res.statusCode).toEqual(200)
      const data = res.result as Array<{_id: string, value: number}>
      expect(data.length).toEqual(100)
      expect(data[0]).toMatchObject({ value: 0 })
    })

    it('get simple collection sorted with query', async () => {
      const res = await server.inject({
        method: 'get',
        url: '/collections/items?sort=["value",1]&query={"value":5}'
      })
      expect(res.statusCode).toEqual(200)
      const data = res.result as Array<{_id: string, value: number}>
      expect(data.length).toEqual(1)
      expect(data[0]).toMatchObject({ value: 5 })
    })

    it('get simple collection second page', async () => {
      let res = await server.inject({
        method: 'get',
        url: '/collections/items?limit=10'
      })
      expect(res.statusCode).toEqual(200)
      let data = res.result as Array<{_id: ObjectId, value: number}>
      const firstPageLastElement = last(data)
      res = await server.inject({
        method: 'get',
        url: `/collections/items?limit=10&last=${firstPageLastElement!._id.toHexString()}`
      })
      expect(res.statusCode).toEqual(200)
      data = res.result as Array<{_id: ObjectId, value: number}>
      expect(data[0].value).toEqual(inputNumbers[10])
    })

    it('get simple collection second page with query', async () => {
      const validNumbers = inputNumbers.filter(n => n > 5)
      let res = await server.inject({
        method: 'get',
        url: '/collections/items?query={"value":{"$gt": 5}}&limit=10'
      })
      expect(res.statusCode).toEqual(200)
      let data = res.result as Array<{_id: string, value: number}>
      const firstPageLastElement = last(data)
      res = await server.inject({
        method: 'get',
        url: `/collections/items?query={"value":{"$gt": 5}}&limit=10&last=${firstPageLastElement!._id}`
      })
      expect(res.statusCode).toEqual(200)
      data = res.result as Array<{_id: string, value: number}>
      expect(data[0].value).toEqual(validNumbers[10])
    })

    it('get simple collection second page with sort', async () => {
      let res = await server.inject({
        method: 'get',
        url: '/collections/items?sort=["value",1]&limit=10'
      })
      expect(res.statusCode).toEqual(200)
      let data = res.result as Array<{_id: string, value: number}>
      console.log(data)
      const firstPageLastElement = last(data)
      res = await server.inject({
        method: 'get',
        url: `/collections/items?sort=["value",1]&limit=10&last=${firstPageLastElement!._id}`
      })
      expect(res.statusCode).toEqual(200)
      data = res.result as Array<{_id: string, value: number}>
      console.log(data)
      expect(data[0].value).toEqual(10)
    })

    it('get simple collection sorted with query second page', async () => {
      let res = await server.inject({
        method: 'get',
        url: '/collections/items?sort=["value",1]&query={"value":{"$gt": 5}}&limit=10'
      })
      expect(res.statusCode).toEqual(200)
      let data = res.result as Array<{_id: string, value: number}>
      const firstPageLastElement = last(data)
      res = await server.inject({
        method: 'get',
        url: `/collections/items?sort=["value",1]&query={"value":{"$gt": 5}}&limit=10&last=${firstPageLastElement!._id}`
      })
      expect(res.statusCode).toEqual(200)
      data = res.result as Array<{_id: string, value: number}>
      expect(data[0].value).toEqual(16)
    })
  })
})
