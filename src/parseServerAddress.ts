

export const parseServerAddress = (address: string | undefined, removeHttp = true): ParsedServerAddress => {
  if (!address) {
    return { host: '', isWebSocket: false }
  }

  const isWebSocket = address.startsWith('ws://') || address.startsWith('wss://')
  if (isWebSocket) {
    return { host: address, isWebSocket: true }
  }

  if (removeHttp) {
    address = address.replace(/^https?:\/\//, '')
  }

  const parts = address.split(':')

  let version: string | null = null
  let port: string | null = null

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (/^\d+\.\d+(\.\d+)?$/.test(part)) {
      version = part
      parts.splice(i, 1)
      i--
    }
    if (/^\d+$/.test(part)) {
      port = part
      parts.splice(i, 1)
      i--
    }
  }

  return {
    host: parts.join(':'),
    ...(port ? { port } : {}),
    ...(version ? { version } : {}),
    isWebSocket: false
  }
}

export interface ParsedServerAddress {
  host: string
  port?: string
  version?: string
  isWebSocket: boolean
}
