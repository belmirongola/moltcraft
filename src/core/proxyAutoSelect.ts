import { proxy } from 'valtio'
import { appStorage } from '../react/appStorageProvider'
import { pingProxyServer } from './pingProxy'

export interface ProxyPingState {
  selectedProxy: string | null
  proxyStatus: Record<string, {
    status: 'checking' | 'success' | 'error'
    latency?: number
    error?: string
  }>
  checkStarted: boolean
}

export const proxyPingState = proxy<ProxyPingState>({
  selectedProxy: null,
  proxyStatus: {},
  checkStarted: false
})

let currentPingAbortController: AbortController | null = null

export async function selectBestProxy (proxies: string[]): Promise<string | null> {
  if (proxyPingState.checkStarted) {
    cancelProxyPinging()
  }
  proxyPingState.checkStarted = true

  // Cancel any ongoing pings
  if (currentPingAbortController) {
    currentPingAbortController.abort()
  }
  currentPingAbortController = new AbortController()
  const abortController = currentPingAbortController // Store in local const to satisfy TypeScript

  // Reset ping states
  for (const proxy of proxies) {
    proxyPingState.proxyStatus[proxy] = { status: 'checking' }
  }

  try {
    // Create a promise for each proxy
    const pingPromises = proxies.map(async (proxy) => {
      if (proxy.startsWith(':')) {
        proxy = `${location.protocol}//${location.hostname}${proxy}`
      }
      try {
        const result = await pingProxyServer(proxy, abortController.signal)
        if (result.success) {
          proxyPingState.proxyStatus[proxy] = { status: 'success', latency: result.latency }
          return { proxy, latency: result.latency }
        } else {
          proxyPingState.proxyStatus[proxy] = { status: 'error', error: result.error }
          return null
        }
      } catch (err) {
        proxyPingState.proxyStatus[proxy] = { status: 'error', error: String(err) }
        return null
      }
    })

    // Use Promise.race to get the first successful response
    const results = await Promise.race([
      // Wait for first successful ping
      Promise.any(pingPromises.map(async p => p.then(r => r && { type: 'success' as const, data: r }))),
      // Or wait for all to fail
      Promise.all(pingPromises).then(results => {
        if (results.every(r => r === null)) {
          return { type: 'all-failed' as const }
        }
        return null
      })
    ])

    if (!results || results.type === 'all-failed') {
      return null
    }

    return results.type === 'success' ? results.data.proxy : null
  } finally {
    currentPingAbortController = null
    proxyPingState.checkStarted = false
  }
}

export function cancelProxyPinging () {
  if (currentPingAbortController) {
    currentPingAbortController.abort()
    currentPingAbortController = null
  }
}
