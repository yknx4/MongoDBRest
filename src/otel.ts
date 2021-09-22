import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb'
import { HapiInstrumentation } from '@opentelemetry/instrumentation-hapi'
import { JaegerExporter } from '@opentelemetry/exporter-jaeger'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { config } from './config'

if (config.isProd && config.otelServiceName !== '') {
  const provider = new NodeTracerProvider()
  const exporter = new JaegerExporter()
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
  provider.register()

  // register and load instrumentation and old plugins - old plugins will be loaded automatically as previously
  // but instrumentations needs to be added
  registerInstrumentations({
    instrumentations: [
      ...getNodeAutoInstrumentations(),
      new HapiInstrumentation(),
      new MongoDBInstrumentation({ enhancedDatabaseReporting: true }),
      new HttpInstrumentation(),
      new HapiInstrumentation()
    ]
  })
}
