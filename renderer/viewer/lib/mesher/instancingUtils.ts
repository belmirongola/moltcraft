import { WorldBlock as Block, World } from './world'

export const isBlockInstanceable = (world: World, block: Block): boolean => {
  const instancedBlocks = world?.instancedBlocks
  if (!instancedBlocks) return false
  return instancedBlocks.includes(block.stateId)
}
