import { MongoClient } from 'mongodb'
import { config } from './config'

export const mongoClient = new MongoClient(config.mongodbstring, { maxPoolSize: 20, minPoolSize: 2, loggerLevel: config.isProd ? 'warn' : 'debug' })
