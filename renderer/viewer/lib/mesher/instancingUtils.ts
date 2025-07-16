import { WorldBlock as Block, World } from './world'

// Returns true if the block is instanceable (full cube, no rotations, etc.)
export const isBlockInstanceable = (world: World, block: Block): boolean => {
  // Use dynamic instanceable blocks data if available
  const instancedBlocks = world?.instancedBlocks
  return instancedBlocks?.includes(block.name) ?? false
}
