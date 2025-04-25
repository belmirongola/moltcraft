import { LightWorld, createLightEngineForSyncWorld, convertPrismarineBlockToWorldBlock } from 'minecraft-lighting'
import { world } from 'prismarine-world'
import { WorldRendererCommon } from './worldrendererCommon'

let lightEngine: LightWorld | null = null
export const getLightEngine = () => {
  if (!lightEngine) throw new Error('Light engine not initialized')
  return lightEngine
}
export const getLightEngineSafe = () => {
  return lightEngine
}

export const createLightEngine = (world: WorldRendererCommon) => {
  lightEngine = createLightEngineForSyncWorld(world.displayOptions.worldView.world as unknown as world.WorldSync, loadedData, {
    minY: world.worldSizeParams.minY,
    height: world.worldSizeParams.worldHeight,
    // enableSkyLight: false,
  })
  lightEngine.PARALLEL_CHUNK_PROCESSING = false
  globalThis.lightEngine = lightEngine
}

export const processLightChunk = async (x: number, z: number) => {
  const chunkX = Math.floor(x / 16)
  const chunkZ = Math.floor(z / 16)
  const engine = getLightEngine()
  // fillColumnWithZeroLight(engine.externalWorld, chunkX, chunkZ)

  const updated = engine.receiveUpdateColumn(chunkX, chunkZ)
  return updated
}

export const dumpLightData = (x: number, z: number) => {
  const engine = getLightEngineSafe()
  return engine?.worldLightHolder.dumpChunk(Math.floor(x / 16), Math.floor(z / 16))
}

export const updateBlockLight = (x: number, y: number, z: number, stateId: number) => {
  const engine = getLightEngine()
  engine.setBlock(x, y, z, convertPrismarineBlockToWorldBlock(mcData.blocks[stateId], loadedData))
}
