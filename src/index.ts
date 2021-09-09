import './otel'
import { init, start } from './server'

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})

init().then(async s => await start(s)).catch(e => {
  console.error(e)
  process.exit(1)
})
