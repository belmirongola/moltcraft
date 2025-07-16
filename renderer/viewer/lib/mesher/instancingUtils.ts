import { WorldBlock as Block, World } from './world'

// Returns true if the block is instanceable (full cube, no rotations, etc.)
export const isBlockInstanceable = (world: World, block: Block): boolean => {
  // Use dynamic instanceable blocks data if available
  const instancedBlocks = world?.instancedBlocks
  if (Array.isArray(instancedBlocks)) {
    if (!instancedBlocks.includes(block.name)) return false
  } else {
    return false
  }

  // Check if it's actually a full cube (no rotations, no complex models)
  if (!block.models || block.models.length !== 1) return false

  const model = block.models[0][0] // First variant of first model
  if (!model || model.x || model.y || model.z) return false // No rotations

  // Check if all elements are full cubes
  return (model.elements ?? []).every(element => {
    return element.from[0] === 0 && element.from[1] === 0 && element.from[2] === 0 &&
      element.to[0] === 16 && element.to[1] === 16 && element.to[2] === 16
  })
}
