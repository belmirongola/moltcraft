import * as THREE from 'three'
import { Vec3 } from 'vec3'
import { versionToNumber } from 'flying-squid/dist/utils'
import PrismarineBlock from 'prismarine-block'
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
  stateIdToModelIdMap: Record<number, number>
  blockNameToIdMap: Record<string, number>
  interestedTextureTiles: Set<string>
}

export class InstancedRenderer {
  private readonly instancedMeshes = new Map<number, THREE.InstancedMesh>()
  private readonly sceneUsedMeshes = new Map<string, THREE.InstancedMesh>()
  private readonly blockCounts = new Map<number, number>()
  private readonly sectionInstances = new Map<string, Map<number, number[]>>()
  private readonly cubeGeometry: THREE.BoxGeometry
  private readonly tempMatrix = new THREE.Matrix4()
  private readonly blockIdToName = new Map<number, string>()

  // Dynamic instance management
  private readonly initialInstancesPerBlock = 2000 // Increased initial size to reduce early resizing
  private readonly maxInstancesPerBlock = 100_000 // Cap per block type
  private readonly maxTotalInstances = 10_000_000 // Total instance budget
  private currentTotalInstances = 0
  private readonly growthFactor = 1.5 // How much to grow when needed

  // Visibility control
  private _instancedMeshesVisible = true

  // Memory tracking
  private totalAllocatedInstances = 0

  // New properties for dynamic block detection
  private instancedBlocksConfig: InstancedBlocksConfig | null = null
  private sharedMaterial: THREE.MeshLambertMaterial | null = null

  constructor (private readonly worldRenderer: WorldRendererThree) {
    this.cubeGeometry = this.createCubeGeometry()
  }

  private getBlockId (blockName: string): number {
    if (!this.instancedBlocksConfig) {
      throw new Error('Instanced blocks config not prepared')
    }

    const blockId = this.instancedBlocksConfig.blockNameToIdMap[blockName]
    if (blockId === undefined) {
      throw new Error(`Block ${blockName} not found in blockNameToIdMap`)
    }

    return blockId
  }

  // Add getter/setter for visibility
  get instancedMeshesVisible (): boolean {
    return this._instancedMeshesVisible
  }

  set instancedMeshesVisible (visible: boolean) {
    this._instancedMeshesVisible = visible
    // Update all instanced meshes visibility
    for (const mesh of this.instancedMeshes.values()) {
      mesh.visible = visible
    }
  }

  private getInitialInstanceCount (blockName: string): number {
    // Start with small allocation, can grow later if needed
    return Math.min(this.initialInstancesPerBlock, this.maxInstancesPerBlock)
  }

  debugResizeMesh () {
    // Debug helper to test resize operation
    const blockName = 'grass_block'
    const blockId = this.getBlockId(blockName)
    const mesh = this.instancedMeshes.get(blockId)
    this.resizeInstancedMesh(blockId, mesh!.instanceMatrix.count * this.growthFactor)
  }

  private resizeInstancedMesh (blockId: number, newSize: number): boolean {
    const mesh = this.instancedMeshes.get(blockId)
    if (!mesh) return false

    const blockName = this.blockIdToName.get(blockId) || 'unknown'
    const oldSize = mesh.instanceMatrix.count
    const actualInstanceCount = this.blockCounts.get(blockId) || 0

    console.log(`Growing instances for ${blockName}: ${oldSize} -> ${newSize} (${((newSize / oldSize - 1) * 100).toFixed(1)}% increase)`)

    const { geometry } = mesh
    const { material } = mesh

    // Create new mesh with increased capacity
    const newMesh = new THREE.InstancedMesh(
      geometry,
      material,
      newSize
    )
    newMesh.name = mesh.name
    newMesh.frustumCulled = false
    newMesh.visible = this._instancedMeshesVisible

    // Copy ALL existing instances using our tracked count
    for (let i = 0; i < actualInstanceCount; i++) {
      this.tempMatrix.identity()
      mesh.getMatrixAt(i, this.tempMatrix)
      newMesh.setMatrixAt(i, this.tempMatrix)
    }

    newMesh.count = actualInstanceCount
    newMesh.instanceMatrix.needsUpdate = true

    this.totalAllocatedInstances += (newSize - oldSize)

    this.worldRenderer.scene.add(newMesh)
    this.instancedMeshes.set(blockId, newMesh)
    this.worldRenderer.scene.remove(mesh)

    // Clean up old mesh
    mesh.geometry.dispose()
    if (Array.isArray(mesh.material)) {
      for (const m of mesh.material) m.dispose()
    } else {
      mesh.material.dispose()
    }

    // Verify instance count matches
    console.log(`Finished growing ${blockName}. Actual instances: ${actualInstanceCount}, New capacity: ${newSize}, Mesh count: ${newMesh.count}`)

    return true
  }

  private canAddMoreInstances (blockId: number, count: number): boolean {
    const currentForBlock = this.blockCounts.get(blockId) || 0
    const mesh = this.instancedMeshes.get(blockId)
    if (!mesh) return false

    const blockName = this.blockIdToName.get(blockId) || 'unknown'

    // If we would exceed current capacity, try to grow
    if (currentForBlock + count > mesh.instanceMatrix.count) {
      const currentCapacity = mesh.instanceMatrix.count
      const neededCapacity = currentForBlock + count
      const newSize = Math.min(
        this.maxInstancesPerBlock,
        Math.ceil(Math.max(
          neededCapacity,
          currentCapacity * this.growthFactor
        ))
      )

      console.log(`Need to grow ${blockName}: current ${currentForBlock}/${currentCapacity}, need ${neededCapacity}, growing to ${newSize}`)

      // Check if growth would exceed total budget
      const growthAmount = newSize - currentCapacity
      if (this.totalAllocatedInstances + growthAmount > this.maxTotalInstances) {
        console.warn(`Cannot grow instances for ${blockName}: would exceed total budget`)
        return false
      }

      // Try to grow
      if (!this.resizeInstancedMesh(blockId, newSize)) {
        console.warn(`Failed to grow instances for ${blockName}`)
        return false
      }
    }

    // Check total instance budget
    if (this.currentTotalInstances + count > this.maxTotalInstances) {
      console.warn(`Total instance limit reached (${this.currentTotalInstances}/${this.maxTotalInstances})`)
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

    const { forceInstancedOnly } = this.worldRenderer.worldRendererConfig
    const debugBlocksMap = forceInstancedOnly ? {
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
    } : {}

    const isPreflat = versionToNumber(this.worldRenderer.version) < versionToNumber('1.13')
    const PBlockOriginal = PrismarineBlock(this.worldRenderer.version)

    const instanceableBlocks = new Set<string>()
    const blocksDataModel = {} as Record<string, InstancedBlockModelData>
    const interestedTextureTiles = new Set<string>()
    const stateIdToModelIdMap = {} as Record<number, number>
    const blockNameToIdMap = {} as Record<string, number>
    let nextModelId = 0

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

      const blockId = nextModelId++
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

      stateIdToModelIdMap[state] = blockId
      blocksDataModel[blockId] = blockData
      instanceableBlocks.add(name)
      blockNameToIdMap[name] = blockId

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
        const mapping = debugBlocksMap[b.name]
        const block = PBlockOriginal.fromStateId(mapping && (globalThis as any).loadedData.blocksByName[mapping] ? (globalThis as any).loadedData.blocksByName[mapping].defaultState : state, 0)
        if (isPreflat) {
          getPreflatBlock(block)
        }

        const textureOverride = textureOverrideFullBlocks[block.name] as string | undefined
        if (textureOverride) {
          const blockId = nextModelId++
          const { currentResources } = this.worldRenderer.resourcesManager
          if (!currentResources?.worldBlockProvider) continue
          const texture = currentResources.worldBlockProvider.getTextureInfo(textureOverride)
          if (!texture) {
            console.warn('Missing texture override for', block.name)
            continue
          }
          const texIndex = texture.tileIndex
          stateIdToModelIdMap[state] = blockId
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
          blockNameToIdMap[block.name] = blockId
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
      stateIdToModelIdMap,
      blockNameToIdMap,
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

  // Update initializeInstancedMeshes to respect visibility setting
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
      const initialCount = this.getInitialInstanceCount(blockName)

      const geometry = blockModelData ? this.createCustomGeometry(0, blockModelData) : this.cubeGeometry
      const material = this.createBlockMaterial(blockName)

      const mesh = new THREE.InstancedMesh(
        geometry,
        material,
        initialCount
      )
      mesh.name = `instanced_${blockName}`
      mesh.frustumCulled = false
      mesh.count = 0
      mesh.visible = this._instancedMeshesVisible // Set initial visibility

      this.instancedMeshes.set(blockId, mesh)
      this.worldRenderer.scene.add(mesh)
      this.totalAllocatedInstances += initialCount

      if (!blockModelData) {
        console.warn(`No block model data found for block ${blockName}`)
      }
    }
  }

  private debugRaycast () {
    // get instanced block name
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.worldRenderer.camera)
    const intersects = raycaster.intersectObjects(this.worldRenderer.scene.children.filter(child => child.visible))
    for (const intersect of intersects) {
      const mesh = intersect.object as THREE.Mesh
      if (mesh.name.startsWith('instanced_')) {
        console.log(`Instanced block name: ${mesh.name}`)
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

      const instanceIndices: number[] = []
      const currentCount = this.blockCounts.get(blockId) || 0

      // Check if we can add all positions at once
      const neededInstances = blockData.positions.length
      if (!this.canAddMoreInstances(blockId, neededInstances)) {
        console.warn(`Cannot add ${neededInstances} instances for block ${blockName} (current: ${currentCount}, max: ${this.maxInstancesPerBlock})`)
        continue
      }

      const mesh = this.instancedMeshes.get(blockId)!

      // Add new instances for this section
      for (const pos of blockData.positions) {
        const instanceIndex = currentCount + instanceIndices.length
        this.tempMatrix.setPosition(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5)
        mesh.setMatrixAt(instanceIndex, this.tempMatrix)
        instanceIndices.push(instanceIndex)
      }

      // Update tracking
      if (instanceIndices.length > 0) {
        sectionMap.set(blockId, instanceIndices)
        const newCount = currentCount + instanceIndices.length
        this.blockCounts.set(blockId, newCount)
        this.currentTotalInstances += instanceIndices.length
        mesh.count = newCount // Ensure mesh.count matches our tracking
        mesh.instanceMatrix.needsUpdate = true

        // Only track mesh in sceneUsedMeshes if it's actually being used
        if (newCount > 0) {
          this.sceneUsedMeshes.set(blockName, mesh)
        }
      }
    }
  }

  removeSectionInstances (sectionKey: string) {
    const sectionMap = this.sectionInstances.get(sectionKey)
    if (!sectionMap) return // Section not tracked

    // Remove instances for each block type in this section
    for (const [blockId, instanceIndices] of sectionMap) {
      this.removeInstancesFromBlock(blockId, instanceIndices)

      // Remove from sceneUsedMeshes if no instances left
      const blockName = this.blockIdToName.get(blockId)
      if (blockName && (this.blockCounts.get(blockId) || 0) === 0) {
        this.sceneUsedMeshes.delete(blockName)
      }
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

    // Update sceneUsedMeshes if no instances left
    if (newCount === 0) {
      const blockName = this.blockIdToName.get(blockId)
      if (blockName) {
        this.sceneUsedMeshes.delete(blockName)
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
    this.sceneUsedMeshes.clear()
    this.cubeGeometry.dispose()
  }

  // Add visibility info to stats
  getStats () {
    let totalInstances = 0
    let activeBlockTypes = 0
    let totalWastedMemory = 0

    for (const [blockId, mesh] of this.instancedMeshes) {
      const allocated = mesh.instanceMatrix.count
      const used = mesh.count
      totalWastedMemory += (allocated - used) * 64 // 64 bytes per instance (approximate)

      if (used > 0) {
        totalInstances += used
        activeBlockTypes++
      }
    }

    const maxPerBlock = this.maxInstancesPerBlock
    const renderDistance = this.worldRenderer.viewDistance

    return {
      totalInstances,
      activeBlockTypes,
      drawCalls: this._instancedMeshesVisible ? activeBlockTypes : 0,
      memoryStats: {
        totalAllocatedInstances: this.totalAllocatedInstances,
        usedInstances: totalInstances,
        wastedInstances: this.totalAllocatedInstances - totalInstances,
        estimatedMemoryUsage: this.totalAllocatedInstances * 64,
        estimatedWastedMemory: totalWastedMemory,
        utilizationPercent: ((totalInstances / this.totalAllocatedInstances) * 100).toFixed(1) + '%'
      },
      maxInstancesPerBlock: maxPerBlock,
      totalInstanceBudget: this.maxTotalInstances,
      renderDistance,
      instanceUtilization: totalInstances / this.maxTotalInstances,
      instancedMeshesVisible: this._instancedMeshesVisible
    }
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
