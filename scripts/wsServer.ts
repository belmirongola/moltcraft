import WebSocket from 'ws'

export function startWsServer(port: number = 8081) {
  const wss = new WebSocket.Server({ port })

  console.log(`WebSocket server started on port ${port}`)

  wss.on('connection', (ws) => {
    console.log('Client connected')

    ws.on('message', (message) => {
      try {
        // Simply relay the message to all connected clients except sender
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(message.toString())
          }
        })
      } catch (error) {
        console.error('Error processing message:', error)
      }
    })

    ws.on('close', () => {
      console.log('Client disconnected')
    })
  })

  return wss
}
