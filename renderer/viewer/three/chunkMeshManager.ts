import * as THREE from 'three'
import { MesherGeometryOutput } from '../lib/mesher/shared'

export interface ChunkMeshPool {
  mesh: THREE.Mesh
  inUse: boolean
  lastUsedTime: number
  sectionKey?: string
}

export class ChunkMeshManager {
  private readonly meshPool: ChunkMeshPool[] = []
  private readonly activeSections = new Map<string, ChunkMeshPool>()
  private poolSize: number
  private maxPoolSize: number
  private minPoolSize: number

  // Performance tracking
  private hits = 0
  private misses = 0

  // Debug flag to bypass pooling
  public bypassPooling = false

  constructor (
    public material: THREE.Material,
    public worldHeight: number,
    viewDistance = 3,
  ) {
    this.updateViewDistance(viewDistance)

    console.log(`ChunkMeshManager: Initializing with pool size ${this.poolSize} (min: ${this.minPoolSize}, max: ${this.maxPoolSize})`)

    this.initializePool()
  }

  private initializePool () {
    // Create initial pool
    for (let i = 0; i < this.poolSize; i++) {
      const geometry = new THREE.BufferGeometry()
      const mesh = new THREE.Mesh(geometry, this.material)
      mesh.visible = false
      mesh.matrixAutoUpdate = false
      mesh.name = 'pooled-section-mesh'

      const poolEntry: ChunkMeshPool = {
        mesh,
        inUse: false,
        lastUsedTime: 0
      }

      this.meshPool.push(poolEntry)
      // Don't add to scene here - meshes will be added to containers
    }
  }

  /**
   * Update or create a section with new geometry data
   */
  updateSection (sectionKey: string, geometryData: MesherGeometryOutput): THREE.Mesh | null {
    // Normal pooling mode
    // Check if section already exists
    let poolEntry = this.activeSections.get(sectionKey)

    if (!poolEntry) {
      // Get mesh from pool
      poolEntry = this.acquireMesh()
      if (!poolEntry) {
        console.warn(`ChunkMeshManager: No available mesh in pool for section ${sectionKey}`)
        return null
      }

      this.activeSections.set(sectionKey, poolEntry)
      poolEntry.sectionKey = sectionKey
    }

    const { mesh } = poolEntry
    const { geometry } = mesh

    // Update geometry attributes efficiently
    this.updateGeometryAttribute(geometry, 'position', geometryData.positions, 3)
    this.updateGeometryAttribute(geometry, 'normal', geometryData.normals, 3)
    this.updateGeometryAttribute(geometry, 'color', geometryData.colors, 3)
    this.updateGeometryAttribute(geometry, 'uv', geometryData.uvs, 2)

    // Use direct index assignment for better performance (like before)
    geometry.index = new THREE.BufferAttribute(geometryData.indices as Uint32Array | Uint16Array, 1)

    // Set bounding box and sphere for the 16x16x16 section
    geometry.boundingBox = new THREE.Box3(
      new THREE.Vector3(-8, -8, -8),
      new THREE.Vector3(8, 8, 8)
    )
    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, 0),
      Math.sqrt(3 * 8 ** 2)
    )

    // Position the mesh
    mesh.position.set(geometryData.sx, geometryData.sy, geometryData.sz)
    mesh.updateMatrix()
    mesh.visible = true

    // Store metadata
    ;(mesh as any).tilesCount = geometryData.positions.length / 3 / 4
    ;(mesh as any).blocksCount = geometryData.blocksCount

    poolEntry.lastUsedTime = performance.now()

    return mesh
  }

  /**
   * Release a section and return its mesh to the pool
   */
  releaseSection (sectionKey: string): boolean {
    const poolEntry = this.activeSections.get(sectionKey)
    if (!poolEntry) {
      return false
    }

    // Hide mesh and mark as available
    poolEntry.mesh.visible = false
    poolEntry.inUse = false
    poolEntry.sectionKey = undefined
    poolEntry.lastUsedTime = 0

    // Clear geometry to free memory
    this.clearGeometry(poolEntry.mesh.geometry)

    this.activeSections.delete(sectionKey)

    return true
  }

  /**
   * Get mesh for section if it exists
   */
  getSectionMesh (sectionKey: string): THREE.Mesh | undefined {
    return this.activeSections.get(sectionKey)?.mesh
  }

  /**
   * Check if section is managed by this pool
   */
  hasSection (sectionKey: string): boolean {
    return this.activeSections.has(sectionKey)
  }

  /**
   * Update pool size based on new view distance
   */
  updateViewDistance (maxViewDistance: number) {
    // Calculate dynamic pool size based on view distance
    const chunksInView = (maxViewDistance * 2 + 1) ** 2
    const maxSectionsPerChunk = this.worldHeight / 16
    const avgSectionsPerChunk = 5
    this.minPoolSize = Math.floor(chunksInView * avgSectionsPerChunk)
    this.maxPoolSize = Math.floor(chunksInView * maxSectionsPerChunk) + 1
    this.poolSize ??= this.minPoolSize

    // Expand pool if needed to reach optimal size
    if (this.minPoolSize > this.poolSize) {
      const targetSize = Math.min(this.minPoolSize, this.maxPoolSize)
      this.expandPool(targetSize)
    }

    console.log(`ChunkMeshManager: Updated view max distance to ${maxViewDistance}, pool: ${this.poolSize}/${this.maxPoolSize}, optimal: ${this.minPoolSize}`)
  }

  /**
   * Get pool statistics
   */
  getStats () {
    const freeCount = this.meshPool.filter(entry => !entry.inUse).length
    const hitRate = this.hits + this.misses > 0 ? (this.hits / (this.hits + this.misses) * 100).toFixed(1) : '0'

    return {
      poolSize: this.poolSize,
      activeCount: this.activeSections.size,
      freeCount,
      hitRate: `${hitRate}%`,
      hits: this.hits,
      misses: this.misses
    }
  }

  /**
   * Cleanup and dispose resources
   */
  dispose () {
    // Release all active sections
    for (const [sectionKey] of this.activeSections) {
      this.releaseSection(sectionKey)
    }

    // Dispose all meshes and geometries
    for (const poolEntry of this.meshPool) {
      // Meshes will be removed from scene when their parent containers are removed
      poolEntry.mesh.geometry.dispose()
    }

    this.meshPool.length = 0
    this.activeSections.clear()
  }

  // Private helper methods

  private acquireMesh (): ChunkMeshPool | undefined {
    if (this.bypassPooling) {
      return {
        mesh: new THREE.Mesh(new THREE.BufferGeometry(), this.material),
        inUse: true,
        lastUsedTime: performance.now()
      }
    }

    // Find first available mesh
    const availableMesh = this.meshPool.find(entry => !entry.inUse)

    if (availableMesh) {
      availableMesh.inUse = true
      this.hits++
      return availableMesh
    }

    // No available mesh, expand pool to accommodate new sections
    let newPoolSize = Math.min(this.poolSize + 16, this.maxPoolSize)
    if (newPoolSize === this.poolSize) {
      newPoolSize = this.poolSize + 8
      this.maxPoolSize = newPoolSize
      console.warn(`ChunkMeshManager: Pool exhausted (${this.poolSize}/${this.maxPoolSize}). Emergency expansion to ${newPoolSize}`)
    }

    this.misses++
    this.expandPool(newPoolSize)
    return this.acquireMesh()
  }

  private expandPool (newSize: number) {
    const oldSize = this.poolSize
    this.poolSize = newSize

    // console.log(`ChunkMeshManager: Expanding pool from ${oldSize} to ${newSize}`)

    // Add new meshes to pool
    for (let i = oldSize; i < newSize; i++) {
      const geometry = new THREE.BufferGeometry()
      const mesh = new THREE.Mesh(geometry, this.material)
      mesh.visible = false
      mesh.matrixAutoUpdate = false
      mesh.name = 'pooled-section-mesh'

      const poolEntry: ChunkMeshPool = {
        mesh,
        inUse: false,
        lastUsedTime: 0
      }

      this.meshPool.push(poolEntry)
      // Don't add to scene here - meshes will be added to containers
    }
  }

  private updateGeometryAttribute (
    geometry: THREE.BufferGeometry,
    name: string,
    array: Float32Array,
    itemSize: number
  ) {
    const attribute = geometry.getAttribute(name)

    if (attribute && attribute.count === array.length / itemSize) {
      // Reuse existing attribute
      ;(attribute.array as Float32Array).set(array)
      attribute.needsUpdate = true
    } else {
      // Create new attribute (this will dispose the old one automatically)
      geometry.setAttribute(name, new THREE.BufferAttribute(array, itemSize))
    }
  }

  private clearGeometry (geometry: THREE.BufferGeometry) {
    // Clear attributes but keep the attribute objects for reuse
    const attributes = ['position', 'normal', 'color', 'uv']
    for (const name of attributes) {
      const attr = geometry.getAttribute(name)
      if (attr) {
        // Just mark as needing update but don't dispose to avoid recreation costs
        attr.needsUpdate = true
      }
    }

    if (geometry.index) {
      geometry.index.needsUpdate = true
    }
  }
}
