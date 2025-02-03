import EventEmitter from 'events'
import clientAutoVersion from 'minecraft-protocol/src/client/autoVersion'

export const pingServerVersion = async (ip: string, port?: number, preferredVersion?: string) => {
  const fakeClient = new EventEmitter() as any
  fakeClient.on('error', (err) => {
    throw new Error(err.message ?? err)
  })
  const options = {
    host: ip,
    port,
    version: preferredVersion,
    noPongTimeout: Infinity // disable timeout
  }
  // let latency = 0
  // fakeClient.autoVersionHooks = [(res) => {
  //   latency = res.latency
  // }]

  // TODO! use client.socket.destroy() instead of client.end() for faster cleanup
  await clientAutoVersion(fakeClient, options)

  await new Promise<void>((resolve, reject) => {
    fakeClient.once('connect_allowed', resolve)
  })
  return {
    version: fakeClient.version,
    // latency,
  }
}

const MAX_PACKET_SIZE = 2_097_152 // 2mb
const MAX_PACKET_DEPTH = 20

export const validatePacket = (name: string, data: any, fullBuffer: Buffer, isFromServer: boolean) => {
  // todo find out why chat is so slow with react
  if (!isFromServer) return

  if (fullBuffer.length > MAX_PACKET_SIZE) {
    console.groupCollapsed(`Packet ${name} is too large: ${fullBuffer.length} bytes`)
    console.log(data)
    console.groupEnd()
    throw new Error(`Packet ${name} is too large: ${fullBuffer.length} bytes`)
  }

  // todo count total number of objects instead of max depth
  const maxDepth = getObjectMaxDepth(data)
  if (maxDepth > MAX_PACKET_DEPTH) {
    console.groupCollapsed(`Packet ${name} have too many nested objects: ${maxDepth}`)
    console.log(data)
    console.groupEnd()
    throw new Error(`Packet ${name} have too many nested objects: ${maxDepth}`)
  }
}

function getObjectMaxDepth (obj: unknown, currentDepth = 0): number {
  // Base case: null or primitive types have depth 0
  if (obj === null || typeof obj !== 'object' || obj instanceof Buffer) {
    return currentDepth
  }

  // Handle arrays and objects
  let maxDepth = currentDepth

  if (Array.isArray(obj)) {
    // For arrays, check each element
    for (const item of obj) {
      const depth = getObjectMaxDepth(item, currentDepth + 1)
      maxDepth = Math.max(maxDepth, depth)
    }
  } else {
    // For objects, check each value
    // eslint-disable-next-line guard-for-in
    for (const key in obj) {
      const depth = getObjectMaxDepth(obj[key], currentDepth + 1)
      maxDepth = Math.max(maxDepth, depth)
    }
  }

  return maxDepth
}
