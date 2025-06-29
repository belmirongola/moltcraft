import * as THREE from 'three'
import { Vec3 } from 'vec3'
import moreBlockData from '../lib/moreBlockDataGenerated.json'
import { WorldRendererThree } from './worldrendererThree'

// Hardcoded list of full blocks that can use instancing
export const INSTANCEABLE_BLOCKS = new Set([
  'grass_block',
  'dirt',
  'stone',
  'cobblestone',
  'mossy_cobblestone',
  'clay',
  'moss_block',
  'spawner',
  'sand',
  'gravel',
  'oak_planks',
  'birch_planks',
  'spruce_planks',
  'jungle_planks',
  'acacia_planks',
  'dark_oak_planks',
  'mangrove_planks',
  'cherry_planks',
  'bamboo_planks',
  'crimson_planks',
  'warped_planks',
  'iron_block',
  'gold_block',
  'diamond_block',
  'emerald_block',
  'netherite_block',
  'coal_block',
  'redstone_block',
  'lapis_block',
  'copper_block',
  'exposed_copper',
  'weathered_copper',
  'oxidized_copper',
  'cut_copper',
  'exposed_cut_copper',
  'weathered_cut_copper',
  'oxidized_cut_copper',
  'waxed_copper_block',
  'waxed_exposed_copper',
  'waxed_weathered_copper',
  'waxed_oxidized_copper',
  'raw_iron_block',
  'raw_copper_block',
  'raw_gold_block',
  'smooth_stone',
  'cobbled_deepslate',
  'deepslate',
  'calcite',
  'tuff',
  'dripstone_block',
  'amethyst_block',
  'budding_amethyst',
  'obsidian',
  'crying_obsidian',
  'bedrock',
  'end_stone',
  'purpur_block',
  'quartz_block',
  'smooth_quartz',
  'nether_bricks',
  'red_nether_bricks',
  'blackstone',
  'gilded_blackstone',
  'polished_blackstone',
  'chiseled_nether_bricks',
  'cracked_nether_bricks',
  'basalt',
  'smooth_basalt',
  'polished_basalt',
  'netherrack',
  'magma_block',
  'soul_sand',
  'soul_soil',
  'ancient_debris',
  'bone_block',
  'packed_ice',
  'blue_ice',
  'ice',
  'snow_block',
  'powder_snow',
  'white_wool',
  'orange_wool',
  'magenta_wool',
  'light_blue_wool',
  'yellow_wool',
  'lime_wool',
  'pink_wool',
  'gray_wool',
  'light_gray_wool',
  'cyan_wool',
  'purple_wool',
  'blue_wool',
  'brown_wool',
  'green_wool',
  'red_wool',
  'black_wool',
  'white_concrete',
  'orange_concrete',
  'magenta_concrete',
  'light_blue_concrete',
  'yellow_concrete',
  'lime_concrete',
  'pink_concrete',
  'gray_concrete',
  'light_gray_concrete',
  'cyan_concrete',
  'purple_concrete',
  'blue_concrete',
  'brown_concrete',
  'green_concrete',
  'red_concrete',
  'black_concrete',
  'white_terracotta',
  'orange_terracotta',
  'magenta_terracotta',
  'light_blue_terracotta',
  'yellow_terracotta',
  'lime_terracotta',
  'pink_terracotta',
  'gray_terracotta',
  'light_gray_terracotta',
  'cyan_terracotta',
  'purple_terracotta',
  'blue_terracotta',
  'brown_terracotta',
  'green_terracotta',
  'red_terracotta',
  'black_terracotta',
  'terracotta',
  'glazed_terracotta',
])

// Helper function to parse RGB color strings from moreBlockDataGenerated.json
function parseRgbColor (rgbString: string): number {
  const match = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(rgbString)
  if (!match) return 0x99_99_99 // Default gray

  const r = parseInt(match[1], 10)
  const g = parseInt(match[2], 10)
  const b = parseInt(match[3], 10)

  return (r << 16) | (g << 8) | b
}

export interface InstancedBlockData {
  blockId: number
  positions: Vec3[]
  blockName: string
  stateId: number
}

export interface InstancedSectionData {
  sectionKey: string
  instancedBlocks: Map<string, InstancedBlockData>
  shouldUseInstancedOnly: boolean
}

export class InstancedRenderer {
  private readonly instancedMeshes = new Map<number, THREE.InstancedMesh>()
  private readonly blockCounts = new Map<number, number>()
  private readonly sectionInstances = new Map<string, Map<number, number[]>>()
  private readonly maxInstancesPerBlock = 100_000
  private readonly cubeGeometry: THREE.BoxGeometry
  private readonly tempMatrix = new THREE.Matrix4()
  private readonly blockIdToName = new Map<number, string>()
  private readonly blockNameToId = new Map<string, number>()
  private nextBlockId = 0

  constructor (private readonly worldRenderer: WorldRendererThree) {
    this.cubeGeometry = this.createCubeGeometry()
    this.initInstancedMeshes()
  }

  private createCubeGeometry (): THREE.BoxGeometry {
    // Create a basic cube geometry
    // For proper texturing, we would need to modify UV coordinates per block type
    // For now, use default BoxGeometry which works with the texture atlas
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    return geometry
  }

  private createCustomGeometry (textureInfo: { u: number, v: number, su: number, sv: number }): THREE.BufferGeometry {
    // Create custom geometry with specific UV coordinates for this block type
    // This would be more complex but would give perfect texture mapping
    const geometry = new THREE.BoxGeometry(1, 1, 1)

    // Get UV attribute
    const uvAttribute = geometry.getAttribute('uv') as THREE.BufferAttribute
    const uvs = uvAttribute.array as Float32Array

    // Modify UV coordinates to use the specific texture region
    // This is a simplified version - real implementation would need to handle all 6 faces properly
    for (let i = 0; i < uvs.length; i += 2) {
      const u = uvs[i]
      const v = uvs[i + 1]

      // Map from 0-1 to the specific texture region
      uvs[i] = textureInfo.u + u * textureInfo.su
      uvs[i + 1] = textureInfo.v + v * textureInfo.sv
    }

    uvAttribute.needsUpdate = true
    return geometry
  }

  private initInstancedMeshes () {
    // Create InstancedMesh for each instanceable block type
    for (const blockName of INSTANCEABLE_BLOCKS) {
      const material = this.createBlockMaterial(blockName)
      const mesh = new THREE.InstancedMesh(
        this.cubeGeometry,
        material,
        this.maxInstancesPerBlock
      )
      mesh.name = `instanced_${blockName}`
      mesh.frustumCulled = false // Important for performance
      mesh.count = 0 // Start with 0 instances

      this.instancedMeshes.set(this.getBlockId(blockName), mesh)
      this.worldRenderer.scene.add(mesh)
    }
  }

  private createBlockMaterial (blockName: string, textureInfo?: { u: number, v: number, su: number, sv: number }): THREE.Material {
    const { enableSingleColorMode } = this.worldRenderer.worldRendererConfig

    if (enableSingleColorMode) {
      // Ultra-performance mode: solid colors only
      const color = this.getBlockColor(blockName)
      return new THREE.MeshBasicMaterial({ color })
    } else {
      // Use texture from the blocks atlas
      // eslint-disable-next-line no-lonely-if
      if (this.worldRenderer.material.map) {
        const material = this.worldRenderer.material.clone()
        // The texture is already the correct blocks atlas texture
        // Individual block textures are handled by UV coordinates in the geometry
        return material
      } else {
        // Fallback to colored material
        const color = this.getBlockColor(blockName)
        return new THREE.MeshLambertMaterial({ color })
      }
    }
  }

  private getBlockColor (blockName: string): number {
    // Get color from moreBlockDataGenerated.json
    const rgbString = moreBlockData.colors[blockName]
    if (rgbString) {
      return parseRgbColor(rgbString)
    }

    // Fallback to default gray if color not found
    return 0x99_99_99
  }

  handleInstancedGeometry (data: InstancedSectionData) {
    const { sectionKey, instancedBlocks } = data

    // Clear previous instances for this section
    this.clearSectionInstances(sectionKey)

    // Add new instances
    for (const [blockName, blockData] of instancedBlocks) {
      if (!INSTANCEABLE_BLOCKS.has(blockName)) continue

      const mesh = this.instancedMeshes.get(this.getBlockId(blockName))
      if (!mesh) continue

      const currentCount = this.blockCounts.get(this.getBlockId(blockName)) || 0
      let instanceIndex = currentCount

      for (const pos of blockData.positions) {
        if (instanceIndex >= this.maxInstancesPerBlock) {
          console.warn(`Exceeded max instances for block ${blockName} (${instanceIndex}/${this.maxInstancesPerBlock})`)
          break
        }

        this.tempMatrix.setPosition(pos.x, pos.y, pos.z)
        mesh.setMatrixAt(instanceIndex, this.tempMatrix)
        instanceIndex++
      }

      mesh.count = instanceIndex
      mesh.instanceMatrix.needsUpdate = true
      this.blockCounts.set(this.getBlockId(blockName), instanceIndex)
    }
  }

  handleInstancedBlocksFromWorker (instancedBlocks: Record<string, any>, sectionKey: string) {
    // Clear existing instances for this section first
    this.removeSectionInstances(sectionKey)

    // Initialize section tracking if not exists
    if (!this.sectionInstances.has(sectionKey)) {
      this.sectionInstances.set(sectionKey, new Map())
    }
    const sectionMap = this.sectionInstances.get(sectionKey)!

    for (const [blockName, blockData] of Object.entries(instancedBlocks)) {
      if (!this.isBlockInstanceable(blockName)) continue

      const { blockId } = blockData
      this.blockIdToName.set(blockId, blockName)

      let mesh = this.instancedMeshes.get(blockId)
      if (!mesh) {
        // Create new mesh if it doesn't exist
        const material = this.createBlockMaterial(blockName, blockData.textureInfo)
        mesh = new THREE.InstancedMesh(
          this.cubeGeometry,
          material,
          this.maxInstancesPerBlock
        )
        mesh.name = `instanced_${blockName}`
        mesh.frustumCulled = false
        mesh.count = 0
        this.instancedMeshes.set(blockId, mesh)
        this.worldRenderer.scene.add(mesh)
      }

      const instanceIndices: number[] = []
      const currentCount = this.blockCounts.get(blockId) || 0

      // Add new instances for this section
      for (const pos of blockData.positions) {
        if (currentCount + instanceIndices.length >= this.maxInstancesPerBlock) {
          console.warn(`Exceeded max instances for block ${blockName} (${currentCount + instanceIndices.length}/${this.maxInstancesPerBlock})`)
          break
        }

        const instanceIndex = currentCount + instanceIndices.length
        this.tempMatrix.setPosition(pos.x, pos.y, pos.z)
        mesh.setMatrixAt(instanceIndex, this.tempMatrix)
        instanceIndices.push(instanceIndex)
      }

      // Update tracking
      if (instanceIndices.length > 0) {
        sectionMap.set(blockId, instanceIndices)
        this.blockCounts.set(blockId, currentCount + instanceIndices.length)
        mesh.count = this.blockCounts.get(blockId) || 0
        mesh.instanceMatrix.needsUpdate = true
      }
    }
  }

  private clearSectionInstances (sectionKey: string) {
    // For now, we'll rebuild all instances each time
    // This could be optimized to track instances per section
    for (const [blockId, mesh] of this.instancedMeshes) {
      mesh.count = 0
      mesh.instanceMatrix.needsUpdate = true
      this.blockCounts.set(blockId, 0)
    }
  }

  removeSectionInstances (sectionKey: string) {
    const sectionMap = this.sectionInstances.get(sectionKey)
    if (!sectionMap) return // Section not tracked

    // Remove instances for each block type in this section
    for (const [blockId, instanceIndices] of sectionMap) {
      const mesh = this.instancedMeshes.get(blockId)
      if (!mesh) continue

      // For efficiency, we'll rebuild the entire instance array by compacting it
      // This removes gaps left by deleted instances
      this.compactInstancesForBlock(blockId, instanceIndices)
    }

    // Remove section from tracking
    this.sectionInstances.delete(sectionKey)
  }

  private compactInstancesForBlock (blockId: number, indicesToRemove: number[]) {
    const mesh = this.instancedMeshes.get(blockId)
    if (!mesh) return

    const currentCount = this.blockCounts.get(blockId) || 0
    const removeSet = new Set(indicesToRemove)

    let writeIndex = 0
    const tempMatrix = new THREE.Matrix4()

    // Compact the instance matrix by removing gaps
    for (let readIndex = 0; readIndex < currentCount; readIndex++) {
      if (!removeSet.has(readIndex)) {
        if (writeIndex !== readIndex) {
          mesh.getMatrixAt(readIndex, tempMatrix)
          mesh.setMatrixAt(writeIndex, tempMatrix)
        }
        writeIndex++
      }
    }

    // Update count and indices in section tracking
    const newCount = writeIndex
    this.blockCounts.set(blockId, newCount)
    mesh.count = newCount
    mesh.instanceMatrix.needsUpdate = true

    // Update all section tracking to reflect compacted indices
    const offset = 0
    for (const [sectionKey, sectionMap] of this.sectionInstances) {
      const sectionIndices = sectionMap.get(blockId)
      if (sectionIndices) {
        const compactedIndices = sectionIndices
          .filter(index => !removeSet.has(index))
          .map(index => index - removeSet.size + offset)

        if (compactedIndices.length > 0) {
          sectionMap.set(blockId, compactedIndices)
        } else {
          sectionMap.delete(blockId)
        }
      }
    }
  }

  shouldUseInstancedRendering (chunkKey: string): boolean {
    const { useInstancedRendering, forceInstancedOnly, instancedOnlyDistance } = this.worldRenderer.worldRendererConfig

    if (!useInstancedRendering) return false
    if (forceInstancedOnly) return true

    // Check distance for automatic switching
    const [x, z] = chunkKey.split(',').map(Number)
    const chunkPos = new Vec3(x * 16, 0, z * 16)
    const [dx, dz] = this.worldRenderer.getDistance(chunkPos)
    const maxDistance = Math.max(dx, dz)

    return maxDistance >= instancedOnlyDistance
  }

  isBlockInstanceable (blockName: string): boolean {
    return INSTANCEABLE_BLOCKS.has(blockName)
  }

  updateMaterials () {
    // Update materials when texture atlas changes
    for (const [blockId, mesh] of this.instancedMeshes) {
      const blockName = this.blockIdToName.get(blockId)
      if (blockName) {
        const newMaterial = this.createBlockMaterial(blockName)
        const oldMaterial = mesh.material
        mesh.material = newMaterial
        if (oldMaterial instanceof THREE.Material) {
          oldMaterial.dispose()
        }
      }
    }
  }

  destroy () {
    // Clean up resources
    for (const [blockId, mesh] of this.instancedMeshes) {
      this.worldRenderer.scene.remove(mesh)
      mesh.geometry.dispose()
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose()
      }
    }
    this.instancedMeshes.clear()
    this.blockCounts.clear()
    this.sectionInstances.clear()
    this.blockIdToName.clear()
    this.blockNameToId.clear()
    this.nextBlockId = 0
    this.cubeGeometry.dispose()
  }

  getStats () {
    let totalInstances = 0
    let activeBlockTypes = 0

    for (const [blockId, mesh] of this.instancedMeshes) {
      if (mesh.count > 0) {
        totalInstances += mesh.count
        activeBlockTypes++
      }
    }

    return {
      totalInstances,
      activeBlockTypes,
      drawCalls: activeBlockTypes, // One draw call per active block type
      memoryEstimate: totalInstances * 64 // Rough estimate in bytes
    }
  }

  private getBlockId (blockName: string): number {
    // Get the block ID from our local map
    let blockId = this.blockNameToId.get(blockName)
    if (blockId === undefined) {
      // If the block ID doesn't exist, create a new one
      blockId = this.nextBlockId++
      this.blockNameToId.set(blockName, blockId)
      this.blockIdToName.set(blockId, blockName)
    }
    return blockId
  }
}
