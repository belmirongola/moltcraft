import { createLightEngineForSyncWorld, convertPrismarineBlockToWorldBlock } from 'minecraft-lighting/src/prismarineShim'
import { LightWorld } from 'minecraft-lighting/src/engine'
import { world } from 'prismarine-world'
import { Chunk } from 'prismarine-world/types/world'
import { fillColumnWithZeroLight } from 'minecraft-lighting/src/testDebug'

let lightEngine: LightWorld | null = null
export const getLightEngine = () => {
  if (!lightEngine) throw new Error('Light engine not initialized')
  return lightEngine
}

export const createLightEngine = () => {
  lightEngine = createLightEngineForSyncWorld(worldView!.world as world.WorldSync, loadedData, {
    minY: viewer.world.worldConfig.minY,
    height: viewer.world.worldConfig.worldHeight,
    enableSkyLight: false,
  })
  globalThis.lightEngine = lightEngine
}

export const processLightChunk = async (x: number, z: number) => {
  const chunkX = Math.floor(x / 16)
  const chunkZ = Math.floor(z / 16)
  const engine = getLightEngine()
  fillColumnWithZeroLight(engine.externalWorld, chunkX, chunkZ)
  return engine.receiveUpdateColumn(chunkX, chunkZ)
}

export const updateBlockLight = (x: number, y: number, z: number, stateId: number) => {
  const engine = getLightEngine()
  engine.setBlock(x, y, z, convertPrismarineBlockToWorldBlock(mcData.blocks[stateId], mcData))
}
