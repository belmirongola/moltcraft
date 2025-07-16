import * as THREE from 'three'
import { Vec3 } from 'vec3'
import { versionToNumber } from 'flying-squid/dist/utils'
import PrismarineBlock, { Block } from 'prismarine-block'
import { IndexedBlock } from 'minecraft-data'
import moreBlockData from '../lib/moreBlockDataGenerated.json'
import { MesherGeometryOutput } from '../lib/mesher/shared'
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
  textureInfos?: Array<{ u: number, v: number, su: number, sv: number }> // Store texture info for each face
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
  private readonly cubeGeometry: THREE.BoxGeometry
  private readonly tempMatrix = new THREE.Matrix4()
  private readonly blockIdToName = new Map<number, string>()
  private readonly blockNameToId = new Map<string, number>()
  private nextBlockId = 0

  // Dynamic instance management
  private readonly baseInstancesPerBlock = 100_000 // Base instances per block type
  private readonly maxTotalInstances = 10_000_000 // Total instance budget across all blocks
  private currentTotalInstances = 0

  // New properties for dynamic block detection
  private instancedBlocksConfig: InstancedBlocksConfig | null = null
  private sharedMaterial: THREE.MeshLambertMaterial | null = null

  constructor (private readonly worldRenderer: WorldRendererThree) {
    this.cubeGeometry = this.createCubeGeometry()
  }

  private getMaxInstancesPerBlock (): number {
    const renderDistance = this.worldRenderer.viewDistance
    if (renderDistance <= 0) return this.baseInstancesPerBlock

    // Calculate dynamic limit based on render distance
    // More render distance = more chunks = need more instances
    const distanceFactor = Math.max(1, renderDistance / 8) // Normalize around render distance 8
    const dynamicLimit = Math.floor(this.baseInstancesPerBlock * distanceFactor)

    // Cap at reasonable limits to prevent memory issues
    return Math.min(dynamicLimit, 500_000)
  }

  private canAddMoreInstances (blockId: number, count: number): boolean {
    const currentForBlock = this.blockCounts.get(blockId) || 0
    const maxPerBlock = this.getMaxInstancesPerBlock()

    // Check per-block limit
    if (currentForBlock + count > maxPerBlock) {
      return false
    }

    // Check total instance budget
    if (this.currentTotalInstances + count > this.maxTotalInstances) {
      console.warn(`Total instance limit reached (${this.currentTotalInstances}/${this.maxTotalInstances}). Consider reducing render distance.`)
      return false
    }

    return true
  }

  prepareInstancedBlocksData (): InstancedBlocksConfig {
    if (this.sharedMaterial) {
      this.sharedMaterial.dispose()
      this.sharedMaterial = null
    }
    this.sharedMaterial = new THREE.MeshLambertMaterial({
      transparent: true,
      alphaTest: 0.1
    })
    this.sharedMaterial.map = this.worldRenderer.material.map

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
        rotation: [0, 0, 0, 0, 0, 0],
        textureInfos: Array.from({ length: 6 }).fill(null).map(() => ({ u: 0, v: 0, su: 0, sv: 0 }))
      }

      const blockId = i++
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

        // Store texture info for this face
        blockData.textureInfos![faceIndex] = {
          u: texture.u,
          v: texture.v,
          su: texture.su,
          sv: texture.sv
        }
      }

      allBlocksStateIdToModelIdMap[state] = blockId
      blocksDataModel[blockId] = blockData
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
          const blockId = i++
          const { currentResources } = this.worldRenderer.resourcesManager
          if (!currentResources?.worldBlockProvider) continue
          const texture = currentResources.worldBlockProvider.getTextureInfo(textureOverride)
          if (!texture) {
            console.warn('Missing texture override for', block.name)
            continue
          }
          const texIndex = texture.tileIndex
          allBlocksStateIdToModelIdMap[state] = blockId
          const blockData: InstancedBlockModelData = {
            textures: [texIndex, texIndex, texIndex, texIndex, texIndex, texIndex],
            rotation: [0, 0, 0, 0, 0, 0],
            filterLight: b.filterLight,
            textureInfos: Array.from({ length: 6 }).fill(null).map(() => ({
              u: texture.u,
              v: texture.v,
              su: texture.su,
              sv: texture.sv
            }))
          }
          blocksDataModel[blockId] = blockData
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

  private createBlockMaterial (blockName: string): THREE.Material {
    const { enableSingleColorMode } = this.worldRenderer.worldRendererConfig

    if (enableSingleColorMode) {
      // Ultra-performance mode: solid colors only
      const color = this.getBlockColor(blockName)
      const material = new THREE.MeshBasicMaterial({ color })
      material.name = `instanced_color_${blockName}`
      return material
    } else {
      return this.sharedMaterial!
    }
  }

  initializeInstancedMeshes () {
    if (!this.instancedBlocksConfig) {
      console.warn('Instanced blocks config not prepared')
      return
    }

    // Create InstancedMesh for each instanceable block type
    for (const blockName of this.instancedBlocksConfig.instanceableBlocks) {
      const blockId = this.getBlockId(blockName)
      if (this.instancedMeshes.has(blockId)) continue // Skip if already exists

      const blockModelData = this.instancedBlocksConfig.blocksDataModel[blockId]

      const geometry = blockModelData ? this.createCustomGeometry(0, blockModelData) : this.cubeGeometry
      const material = this.createBlockMaterial(blockName)

      const mesh = new THREE.InstancedMesh(
        geometry,
        material,
        this.getMaxInstancesPerBlock()
      )
      mesh.name = `instanced_${blockName}`
      mesh.frustumCulled = false // Important for performance
      mesh.count = 0

      this.instancedMeshes.set(blockId, mesh)
      this.worldRenderer.scene.add(mesh)

      if (!blockModelData) {
        console.warn(`No block model data found for block ${blockName}`)
      }
    }
  }

  private createCubeGeometry (): THREE.BoxGeometry {
    // Create a basic cube geometry
    // For proper texturing, we would need to modify UV coordinates per block type
    // For now, use default BoxGeometry which works with the texture atlas
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    return geometry
  }

  private createCustomGeometry (stateId: number, blockModelData: InstancedBlockModelData): THREE.BufferGeometry {
    // Create custom geometry with specific UV coordinates per face
    const geometry = new THREE.BoxGeometry(1, 1, 1)

    // Get UV attribute
    const uvAttribute = geometry.getAttribute('uv') as THREE.BufferAttribute
    const uvs = uvAttribute.array as Float32Array

    if (!blockModelData.textureInfos) {
      console.warn('No texture infos available for block model')
      return geometry
    }

    // BoxGeometry has 6 faces, each with 4 vertices (8 UV values)
    // Three.js BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
    // Our face mapping: [front, bottom, top, right, left, back] = [south, down, up, east, west, north]
    // Map to Three.js indices: [+Z, -Y, +Y, +X, -X, -Z] = [4, 3, 2, 0, 1, 5]

    interface UVVertex {
      u: number
      v: number
    }

    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
      // Map Three.js face index to our face index
      let ourFaceIndex: number
      switch (faceIndex) {
        case 0: ourFaceIndex = 3; break // +X -> right (east)
        case 1: ourFaceIndex = 4; break // -X -> left (west)
        case 2: ourFaceIndex = 2; break // +Y -> top (up)
        case 3: ourFaceIndex = 1; break // -Y -> bottom (down)
        case 4: ourFaceIndex = 0; break // +Z -> front (south)
        case 5: ourFaceIndex = 5; break // -Z -> back (north)
        default: continue
      }

      const textureInfo = blockModelData.textureInfos[ourFaceIndex]
      const rotation = blockModelData.rotation[ourFaceIndex]

      if (!textureInfo) {
        console.warn(`No texture info found for face ${ourFaceIndex}`)
        continue
      }

      const { u, v, su, sv } = textureInfo
      const faceUvStart = faceIndex * 8

      // Get original UVs for this face
      const faceUVs = uvs.slice(faceUvStart, faceUvStart + 8)

      // Apply rotation if needed (0=0°, 1=90°, 2=180°, 3=270°)
      if (rotation > 0) {
        // Each vertex has 2 UV coordinates (u,v)
        // We need to rotate the 4 vertices as a group
        const vertices: UVVertex[] = []
        for (let i = 0; i < 8; i += 2) {
          vertices.push({
            u: faceUVs[i],
            v: faceUVs[i + 1]
          })
        }

        // Rotate vertices
        const rotatedVertices: UVVertex[] = []
        for (let i = 0; i < 4; i++) {
          const srcIndex = (i + rotation) % 4
          rotatedVertices.push(vertices[srcIndex])
        }

        // Write back rotated coordinates
        for (let i = 0; i < 4; i++) {
          faceUVs[i * 2] = rotatedVertices[i].u
          faceUVs[i * 2 + 1] = rotatedVertices[i].v
        }
      }

      // Apply texture atlas coordinates to the potentially rotated UVs
      for (let i = 0; i < 8; i += 2) {
        uvs[faceUvStart + i] = u + faceUVs[i] * su
        uvs[faceUvStart + i + 1] = v + faceUVs[i + 1] * sv
      }
    }

    uvAttribute.needsUpdate = true
    return geometry
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

  handleInstancedBlocksFromWorker (instancedBlocks: MesherGeometryOutput['instancedBlocks'], sectionKey: string) {
    // Initialize section tracking if not exists
    if (!this.sectionInstances.has(sectionKey)) {
      this.sectionInstances.set(sectionKey, new Map())
    }
    const sectionMap = this.sectionInstances.get(sectionKey)!

    // Remove old instances for blocks that are being updated
    const previousBlockIds = [...sectionMap.keys()]
    for (const blockId of previousBlockIds) {
      const instanceIndices = sectionMap.get(blockId)
      if (instanceIndices) {
        this.removeInstancesFromBlock(blockId, instanceIndices)
        sectionMap.delete(blockId)
      }
    }

    // Keep track of blocks that were updated this frame
    for (const [blockName, blockData] of Object.entries(instancedBlocks)) {
      if (!this.isBlockInstanceable(blockName)) continue

      const { blockId, stateId } = blockData
      this.blockIdToName.set(blockId, blockName)

      const mesh = this.instancedMeshes.get(blockId)
      if (!mesh) {
        console.warn(`Failed to find mesh for block ${blockName}`)
        continue
      }

      const instanceIndices: number[] = []
      const currentCount = this.blockCounts.get(blockId) || 0

      // Add new instances for this section (with limit checking)
      for (const pos of blockData.positions) {
        if (!this.canAddMoreInstances(blockId, 1)) {
          console.warn(`Exceeded max instances for block ${blockName} (${currentCount + instanceIndices.length}/${this.getMaxInstancesPerBlock()})`)
          break
        }

        const instanceIndex = currentCount + instanceIndices.length
        this.tempMatrix.setPosition(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5)
        mesh.setMatrixAt(instanceIndex, this.tempMatrix)
        instanceIndices.push(instanceIndex)
      }

      // Update tracking
      if (instanceIndices.length > 0) {
        sectionMap.set(blockId, instanceIndices)
        this.blockCounts.set(blockId, currentCount + instanceIndices.length)
        this.currentTotalInstances += instanceIndices.length
        mesh.count = this.blockCounts.get(blockId) || 0
        mesh.instanceMatrix.needsUpdate = true
      }
    }
  }

  removeSectionInstances (sectionKey: string) {
    const sectionMap = this.sectionInstances.get(sectionKey)
    if (!sectionMap) return // Section not tracked

    // Remove instances for each block type in this section
    for (const [blockId, instanceIndices] of sectionMap) {
      this.removeInstancesFromBlock(blockId, instanceIndices)
    }

    // Remove section from tracking
    this.sectionInstances.delete(sectionKey)
  }

  private removeInstancesFromBlock (blockId: number, indicesToRemove: number[]) {
    const mesh = this.instancedMeshes.get(blockId)
    if (!mesh || indicesToRemove.length === 0) return

    const currentCount = this.blockCounts.get(blockId) || 0
    const removeSet = new Set(indicesToRemove)

    // Update total instance count
    this.currentTotalInstances -= indicesToRemove.length

    // Create mapping from old indices to new indices
    const indexMapping = new Map<number, number>()
    let writeIndex = 0
    const tempMatrix = new THREE.Matrix4()

    // Compact the instance matrix by removing gaps
    for (let readIndex = 0; readIndex < currentCount; readIndex++) {
      if (!removeSet.has(readIndex)) {
        indexMapping.set(readIndex, writeIndex)
        if (writeIndex !== readIndex) {
          mesh.getMatrixAt(readIndex, tempMatrix)
          mesh.setMatrixAt(writeIndex, tempMatrix)
        }
        writeIndex++
      }
    }

    // Update count
    const newCount = writeIndex
    this.blockCounts.set(blockId, newCount)
    mesh.count = newCount
    mesh.instanceMatrix.needsUpdate = true

    // Update all section tracking to reflect new indices
    for (const [sectionKey, sectionMap] of this.sectionInstances) {
      const sectionIndices = sectionMap.get(blockId)
      if (sectionIndices) {
        const updatedIndices = sectionIndices
          .map(index => indexMapping.get(index))
          .filter(index => index !== undefined)

        if (updatedIndices.length > 0) {
          sectionMap.set(blockId, updatedIndices)
        } else {
          sectionMap.delete(blockId)
        }
      }
    }
  }

  isBlockInstanceable (blockName: string): boolean {
    return this.instancedBlocksConfig?.instanceableBlocks.has(blockName) ?? false
  }

  disposeOldMeshes () {
    // Reset total instance count since we're clearing everything
    this.currentTotalInstances = 0

    for (const [blockId, mesh] of this.instancedMeshes) {
      if (mesh.material instanceof THREE.Material && mesh.material.name.startsWith('instanced_color_')) {
        mesh.material.dispose()
      }
      mesh.geometry.dispose()
      this.instancedMeshes.delete(blockId)
      this.worldRenderer.scene.remove(mesh)
    }

    // Clear counts
    this.blockCounts.clear()
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

    const maxPerBlock = this.getMaxInstancesPerBlock()
    const renderDistance = this.worldRenderer.viewDistance

    return {
      totalInstances,
      activeBlockTypes,
      drawCalls: activeBlockTypes, // One draw call per active block type
      memoryEstimate: totalInstances * 64, // Rough estimate in bytes
      maxInstancesPerBlock: maxPerBlock,
      totalInstanceBudget: this.maxTotalInstances,
      renderDistance,
      instanceUtilization: totalInstances / this.maxTotalInstances
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

    this.disposeOldMeshes()
    this.initializeInstancedMeshes()
  }

  // Method to get the current configuration
  getInstancedBlocksConfig (): InstancedBlocksConfig | null {
    return this.instancedBlocksConfig
  }
}
