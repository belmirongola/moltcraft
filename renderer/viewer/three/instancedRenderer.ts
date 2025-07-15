import * as THREE from 'three'
import { Vec3 } from 'vec3'
import { versionToNumber } from 'flying-squid/dist/utils'
import PrismarineBlock, { Block } from 'prismarine-block'
import { IndexedBlock } from 'minecraft-data'
import moreBlockData from '../lib/moreBlockDataGenerated.json'
import { getPreflatBlock } from './getPreflatBlock'
import { WorldRendererThree } from './worldrendererThree'

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

export interface InstancedBlockModelData {
  textures: number[]
  rotation: number[]
  transparent?: boolean
  emitLight?: number
  filterLight?: number
}

export interface InstancedBlocksConfig {
  instanceableBlocks: Set<string>
  blocksDataModel: Record<string, InstancedBlockModelData>
  allBlocksStateIdToModelIdMap: Record<number, number>
  interestedTextureTiles: Set<string>
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

  // New properties for dynamic block detection
  private instancedBlocksConfig: InstancedBlocksConfig | null = null

  constructor (private readonly worldRenderer: WorldRendererThree) {
    this.cubeGeometry = this.createCubeGeometry()
  }

  prepareInstancedBlocksData (): InstancedBlocksConfig {
    const blocksMap = {
      'double_stone_slab': 'stone',
      'stone_slab': 'stone',
      'oak_stairs': 'planks',
      'stone_stairs': 'stone',
      'glass_pane': 'stained_glass',
      'brick_stairs': 'brick_block',
      'stone_brick_stairs': 'stonebrick',
      'nether_brick_stairs': 'nether_brick',
      'double_wooden_slab': 'planks',
      'wooden_slab': 'planks',
      'sandstone_stairs': 'sandstone',
      'cobblestone_wall': 'cobblestone',
      'quartz_stairs': 'quartz_block',
      'stained_glass_pane': 'stained_glass',
      'red_sandstone_stairs': 'red_sandstone',
      'stone_slab2': 'stone_slab',
      'purpur_stairs': 'purpur_block',
      'purpur_slab': 'purpur_block',
    }

    const isPreflat = versionToNumber(this.worldRenderer.version) < versionToNumber('1.13')
    const PBlockOriginal = PrismarineBlock(this.worldRenderer.version)

    const instanceableBlocks = new Set<string>()
    const blocksDataModel = {} as Record<string, InstancedBlockModelData>
    const interestedTextureTiles = new Set<string>()
    const blocksProcessed = {} as Record<string, boolean>
    let i = 0
    const allBlocksStateIdToModelIdMap = {} as Record<number, number>

    const addBlockModel = (state: number, name: string, props: Record<string, any>, mcBlockData?: IndexedBlock, defaultState = false) => {
      const possibleIssues = [] as string[]
      const { currentResources } = this.worldRenderer.resourcesManager
      if (!currentResources?.worldBlockProvider) return

      const models = currentResources.worldBlockProvider.getAllResolvedModels0_1({
        name,
        properties: props
      }, isPreflat, possibleIssues, [], [], true)

      // skipping composite blocks
      if (models.length !== 1 || !models[0]![0].elements) {
        return
      }
      const elements = models[0]![0]?.elements
      if (!elements || (elements.length !== 1 && name !== 'grass_block')) {
        return
      }
      const elem = elements[0]
      if (elem.from[0] !== 0 || elem.from[1] !== 0 || elem.from[2] !== 0 || elem.to[0] !== 16 || elem.to[1] !== 16 || elem.to[2] !== 16) {
        // not full block
        return
      }

      const facesMapping = [
        ['front', 'south'],
        ['bottom', 'down'],
        ['top', 'up'],
        ['right', 'east'],
        ['left', 'west'],
        ['back', 'north'],
      ]

      const blockData: InstancedBlockModelData = {
        textures: [0, 0, 0, 0, 0, 0],
        rotation: [0, 0, 0, 0, 0, 0]
      }

      for (const [face, { texture, cullface, rotation = 0 }] of Object.entries(elem.faces)) {
        const faceIndex = facesMapping.findIndex(x => x.includes(face))
        if (faceIndex === -1) {
          throw new Error(`Unknown face ${face}`)
        }

        blockData.textures[faceIndex] = texture.tileIndex
        blockData.rotation[faceIndex] = rotation / 90
        if (Math.floor(blockData.rotation[faceIndex]) !== blockData.rotation[faceIndex]) {
          throw new Error(`Invalid rotation ${rotation} ${name}`)
        }
        interestedTextureTiles.add(texture.debugName)
      }

      const k = i++
      allBlocksStateIdToModelIdMap[state] = k
      blocksDataModel[k] = blockData
      instanceableBlocks.add(name)
      blocksProcessed[name] = true

      if (mcBlockData) {
        blockData.transparent = mcBlockData.transparent
        blockData.emitLight = mcBlockData.emitLight
        blockData.filterLight = mcBlockData.filterLight
      }
    }

    // Add unknown block model
    addBlockModel(-1, 'unknown', {})

    // Handle texture overrides for special blocks
    const textureOverrideFullBlocks = {
      water: 'water_still',
      lava: 'lava_still',
    }

    // Process all blocks to find instanceable ones
    for (const b of (globalThis as any).loadedData.blocksArray) {
      for (let state = b.minStateId; state <= b.maxStateId; state++) {
        const mapping = blocksMap[b.name]
        const block = PBlockOriginal.fromStateId(mapping && (globalThis as any).loadedData.blocksByName[mapping] ? (globalThis as any).loadedData.blocksByName[mapping].defaultState : state, 0)
        if (isPreflat) {
          getPreflatBlock(block)
        }

        const textureOverride = textureOverrideFullBlocks[block.name] as string | undefined
        if (textureOverride) {
          const k = i++
          const { currentResources } = this.worldRenderer.resourcesManager
          if (!currentResources?.worldBlockProvider) continue
          const texture = currentResources.worldBlockProvider.getTextureInfo(textureOverride)
          if (!texture) {
            console.warn('Missing texture override for', block.name)
            continue
          }
          const texIndex = texture.tileIndex
          allBlocksStateIdToModelIdMap[state] = k
          const blockData: InstancedBlockModelData = {
            textures: [texIndex, texIndex, texIndex, texIndex, texIndex, texIndex],
            rotation: [0, 0, 0, 0, 0, 0],
            filterLight: b.filterLight
          }
          blocksDataModel[k] = blockData
          instanceableBlocks.add(block.name)
          interestedTextureTiles.add(textureOverride)
          continue
        }

        // Check if block is a full cube
        if (block.shapes.length === 0 || !block.shapes.every(shape => {
          return shape[0] === 0 && shape[1] === 0 && shape[2] === 0 && shape[3] === 1 && shape[4] === 1 && shape[5] === 1
        })) {
          continue
        }

        addBlockModel(state, block.name, block.getProperties(), b, state === b.defaultState)
      }
    }

    return {
      instanceableBlocks,
      blocksDataModel,
      allBlocksStateIdToModelIdMap,
      interestedTextureTiles
    }
  }

  initializeInstancedMeshes () {
    if (!this.instancedBlocksConfig) {
      console.warn('Instanced blocks config not prepared')
      return
    }

    // Create InstancedMesh for each instanceable block type
    for (const blockName of this.instancedBlocksConfig.instanceableBlocks) {
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
      if (!this.isBlockInstanceable(blockName)) continue

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
    return this.instancedBlocksConfig?.instanceableBlocks.has(blockName) ?? false
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

  // New method to prepare and initialize everything
  prepareAndInitialize () {
    console.log('Preparing instanced blocks data...')
    this.instancedBlocksConfig = this.prepareInstancedBlocksData()
    console.log(`Found ${this.instancedBlocksConfig.instanceableBlocks.size} instanceable blocks:`,
      [...this.instancedBlocksConfig.instanceableBlocks].slice(0, 10).join(', '),
      this.instancedBlocksConfig.instanceableBlocks.size > 10 ? '...' : '')

    this.initializeInstancedMeshes()
  }

  // Method to get the current configuration
  getInstancedBlocksConfig (): InstancedBlocksConfig | null {
    return this.instancedBlocksConfig
  }
}
