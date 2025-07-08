class LatencyMonitor {
  private ws: WebSocket | null = null
  private isConnected = false

  constructor (public serverUrl: string) {
  }

  async connect () {
    return new Promise<void>((resolve, reject) => {
      // Convert http(s):// to ws(s)://
      let wsUrl = this.serverUrl.replace(/^http/, 'ws') + '/api/vm/net/ping'
      if (!wsUrl.startsWith('ws')) {
        wsUrl = 'wss://' + wsUrl
      }
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        this.isConnected = true
        resolve()
      }
      this.ws.onerror = (error) => {
        reject(error)
      }
    })
  }

  async measureLatency (): Promise<{
    roundTripTime: number;
    serverProcessingTime: number;
    networkLatency: number;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Not connected'))
        return
      }

      const pingId = Date.now().toString()
      const startTime = performance.now()

      const handler = (event: MessageEvent) => {
        if (typeof event.data === 'string' && event.data.startsWith('pong:')) {
          const [_, receivedPingId, serverProcessingTime] = event.data.split(':')

          if (receivedPingId === pingId) {
            this.ws?.removeEventListener('message', handler)
            const roundTripTime = performance.now() - startTime

            resolve({
              roundTripTime,
              serverProcessingTime: parseFloat(serverProcessingTime),
              networkLatency: roundTripTime - parseFloat(serverProcessingTime)
            })
          }
        }
      }

      this.ws?.addEventListener('message', handler)
      this.ws?.send('ping:' + pingId)
    })
  }

  disconnect () {
    if (this.ws) {
      this.ws.close()
      this.isConnected = false
    }
  }
}

export async function pingProxyServer (serverUrl: string, abortSignal?: AbortSignal) {
  try {
    const monitor = new LatencyMonitor(serverUrl)
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        monitor.disconnect()
      })
    }

    await monitor.connect()
    const latency = await monitor.measureLatency()
    monitor.disconnect()
    return {
      success: true,
      latency: Math.round(latency.networkLatency)
    }
  } catch (err) {
    let msg = String(err)
    if (err instanceof Event && err.type === 'error') {
      msg = 'Connection error'
    }
    return {
      success: false,
      error: msg
    }
  }
}

export async function monitorLatency () {
  const monitor = new LatencyMonitor('https://your-server.com')

  try {
    await monitor.connect()

    // Single measurement
    const latency = await monitor.measureLatency()

    // Or continuous monitoring
    setInterval(async () => {
      try {
        const latency = await monitor.measureLatency()
        console.log('Current latency:', latency)
      } catch (error) {
        console.error('Error measuring latency:', error)
      }
    }, 5000) // Check every 5 seconds

  } catch (error) {
    console.error('Failed to connect:', error)
  }
}
