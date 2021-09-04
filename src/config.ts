interface Config {
  mongodbstring: string
  port: string
  host: string
  isProd: boolean
  sentryDsn: string
}

export const config: Config = {
  mongodbstring: process.env.MONGODB_STRING ?? 'mongodb://admin:password@localhost:27017/homie_development?authSource=admin',
  port: process.env.PORT ?? '5000',
  host: process.env.HOST ?? 'localhost',
  isProd: process.env.NODE_ENV === 'production',
  sentryDsn: process.env.SENTRY_DSN ?? ''
}
