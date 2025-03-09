import './protocolWorkerGlobals'
import * as net from 'net'
import { createClient } from 'minecraft-protocol'

// This is a Web Worker for handling protocol-related tasks
// Respond to messages from the main thread
self.onmessage = (e) => {
  const handler = handlers[e.data.type]
  if (handler) {
    handler(e.data)
  }
}

const handlers = {
  setProxy (data: { hostname: string, port: number }) {
    net['setProxy']({ hostname: data.hostname, port: data.port })
  },
  init (data: { options: any }) {
    const client = createClient(data.options)
  }
}
