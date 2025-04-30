import { LightWorld, createLightEngineForSyncWorld, convertPrismarineBlockToWorldBlock } from 'minecraft-lighting'
import { world } from 'prismarine-world'
import { WorldRendererCommon } from './worldrendererCommon'
import { WorldDataEmitter } from './worldDataEmitter'

let lightEngine: LightWorld | null = null
export const getLightEngine = () => {
  if (!lightEngine) throw new Error('Light engine not initialized')
  return lightEngine
}
export const getLightEngineSafe = () => {
  return lightEngine
}

export const createLightEngineIfNeeded = (worldView: WorldDataEmitter) => {
  if (lightEngine) return
  lightEngine = createLightEngineForSyncWorld(worldView.world as unknown as world.WorldSync, loadedData, {
    minY: worldView.minY,
    height: worldView.worldHeight,
    // enableSkyLight: false,
  })
  lightEngine.externalWorld.setBlock = () => {}
  lightEngine.PARALLEL_CHUNK_PROCESSING = false
  globalThis.lightEngine = lightEngine
}

export const processLightChunk = async (x: number, z: number) => {
  const engine = getLightEngineSafe()
  if (!engine) return

  const chunkX = Math.floor(x / 16)
  const chunkZ = Math.floor(z / 16)
  // fillColumnWithZeroLight(engine.externalWorld, chunkX, chunkZ)

  const updated = engine.receiveUpdateColumn(chunkX, chunkZ)
  return updated
}

export const dumpLightData = (x: number, z: number) => {
  const engine = getLightEngineSafe()
  return engine?.worldLightHolder.dumpChunk(Math.floor(x / 16), Math.floor(z / 16))
}

export const getDebugLightValues = (x: number, y: number, z: number) => {
  const engine = getLightEngineSafe()
  return {
    blockLight: engine?.worldLightHolder.getBlockLight(x, y, z) ?? -1,
    skyLight: engine?.worldLightHolder.getSkyLight(x, y, z) ?? -1,
  }
}

export const updateBlockLight = (x: number, y: number, z: number, stateId: number) => {
  const engine = getLightEngineSafe()
  if (!engine) return
  const affected = engine['affectedChunksTimestamps'] as Map<string, number>
  const noAffected = affected.size === 0
  engine.setBlock(x, y, z, convertPrismarineBlockToWorldBlock(stateId, loadedData))

  if (affected.size > 0) {
    const chunks = [...affected.keys()].map(key => {
      return key.split(',').map(Number) as [number, number]
    })
    affected.clear()
    return chunks
  }
}

export const destroyLightEngine = () => {
  lightEngine = null
  globalThis.lightEngine = null
}
