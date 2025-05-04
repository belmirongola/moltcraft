import { LightWorld, createLightEngineForSyncWorld, convertPrismarineBlockToWorldBlock, createPrismarineLightEngineWorker } from 'minecraft-lighting'
import { world } from 'prismarine-world'
// import PrismarineWorker from 'minecraft-lighting/dist/prismarineWorker.worker.js'
import { WorldDataEmitter } from './worldDataEmitter'

let lightEngine: LightWorld | null = null
let lightEngineNew: ReturnType<typeof createPrismarineLightEngineWorker> | null = null

export const getLightEngine = () => {
  if (!lightEngine) throw new Error('Light engine not initialized')
  return lightEngine
}
export const getLightEngineSafe = () => {
  // return lightEngine
  return lightEngineNew
}

export const createLightEngineIfNeeded = (worldView: WorldDataEmitter) => {
  if (lightEngine) return
  lightEngine = createLightEngineForSyncWorld(worldView.world as unknown as world.WorldSync, loadedData, {
    minY: worldView.minY,
    height: worldView.minY + worldView.worldHeight,
    // writeLightToOriginalWorld: true,
    // enableSkyLight: false,
  })
  lightEngine.externalWorld.setBlock = () => {}
  lightEngine.PARALLEL_CHUNK_PROCESSING = false
  globalThis.lightEngine = lightEngine
}

export const createLightEngineIfNeededNew = (worldView: WorldDataEmitter) => {
  if (lightEngineNew) return
  const worker = new Worker(new URL('minecraft-lighting/dist/prismarineWorker.worker.js', import.meta.url))
  lightEngineNew = createPrismarineLightEngineWorker(worker, worldView.world as unknown as world.WorldSync, loadedData)
  lightEngineNew.initialize({
    minY: worldView.minY,
    height: worldView.minY + worldView.worldHeight,
    // writeLightToOriginalWorld: true,
    // enableSkyLight: false,
  })

  globalThis.lightEngine = lightEngineNew
}

export const processLightChunk = async (x: number, z: number, doLighting: boolean) => {
  const engine = getLightEngineSafe()
  if (!engine) return

  const chunkX = Math.floor(x / 16)
  const chunkZ = Math.floor(z / 16)
  // fillColumnWithZeroLight(engine.externalWorld, chunkX, chunkZ)

  const updated = await engine.loadChunk(chunkX, chunkZ, doLighting)
  return updated
}

export const dumpLightData = (x: number, z: number) => {
  const engine = getLightEngineSafe()
  // return engine?.worldLightHolder.dumpChunk(Math.floor(x / 16), Math.floor(z / 16))
}

export const getDebugLightValues = (x: number, y: number, z: number) => {
  const engine = getLightEngineSafe()
  // return {
  //   blockLight: engine?.worldLightHolder.getBlockLight(x, y, z) ?? -1,
  //   skyLight: engine?.worldLightHolder.getSkyLight(x, y, z) ?? -1,
  // }
}

export const updateBlockLight = async (x: number, y: number, z: number, stateId: number, distance: number) => {
  if (distance > 16) return []
  const chunkX = Math.floor(x / 16) * 16
  const chunkZ = Math.floor(z / 16) * 16
  const engine = getLightEngineSafe()
  if (!engine) return
  const start = performance.now()
  const result = await engine.setBlock(x, y, z, stateId)
  const end = performance.now()
  console.log(`[light engine] updateBlockLight (${x}, ${y}, ${z}) took`, Math.round(end - start), 'ms', result.length, 'chunks')
  return result

  // const engine = getLightEngineSafe()
  // if (!engine) return
  // const affected = engine['affectedChunksTimestamps'] as Map<string, number>
  // const noAffected = affected.size === 0
  // engine.setBlock(x, y, z, convertPrismarineBlockToWorldBlock(stateId, loadedData))

  // if (affected.size > 0) {
  //   const chunks = [...affected.keys()].map(key => {
  //     return key.split(',').map(Number) as [number, number]
  //   })
  //   affected.clear()
  //   return chunks
  // }
}

export const lightRemoveColumn = (x: number, z: number) => {
  const engine = getLightEngineSafe()
  if (!engine) return
  engine.unloadChunk(Math.floor(x / 16), Math.floor(z / 16))
}

export const destroyLightEngine = () => {
  lightEngine = null
  globalThis.lightEngine = null
}
