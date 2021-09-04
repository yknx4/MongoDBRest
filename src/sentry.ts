import * as Sentry from '@sentry/node'
import '@sentry/tracing'
import { config } from './config'

// @ts-expect-error
global.__rootdir__ = __dirname ?? process.cwd()

export const sentry = Sentry.init({
  dsn: config.sentryDsn,

  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 1.0
})
