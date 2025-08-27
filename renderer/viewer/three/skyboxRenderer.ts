import * as THREE from 'three'

export class SkyboxRenderer {
  private texture: THREE.Texture | null = null
  private mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null

  constructor (private readonly scene: THREE.Scene, public initialImage: string | null) {}

  async init () {
    if (this.initialImage) {
      await this.setSkyboxImage(this.initialImage)
    }
  }

  async setSkyboxImage (imageUrl: string) {
    // Dispose old textures if they exist
    if (this.texture) {
      this.texture.dispose()
    }

    // Load the equirectangular texture
    const textureLoader = new THREE.TextureLoader()
    this.texture = await new Promise((resolve) => {
      textureLoader.load(
        imageUrl,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping
          texture.encoding = THREE.sRGBEncoding
          // Keep pixelated look
          texture.minFilter = THREE.NearestFilter
          texture.magFilter = THREE.NearestFilter
          texture.needsUpdate = true
          resolve(texture)
        }
      )
    })

    // Create or update the skybox
    if (this.mesh) {
      // Just update the texture on the existing material
      this.mesh.material.map = this.texture
      this.mesh.material.needsUpdate = true
    } else {
      // Create a large sphere geometry for the skybox
      const geometry = new THREE.SphereGeometry(500, 60, 40)
      // Flip the geometry inside out
      geometry.scale(-1, 1, 1)

      // Create material using the loaded texture
      const material = new THREE.MeshBasicMaterial({
        map: this.texture,
        side: THREE.FrontSide // Changed to FrontSide since we're flipping the geometry
      })

      // Create and add the skybox mesh
      this.mesh = new THREE.Mesh(geometry, material)
      this.scene.add(this.mesh)
    }
  }

  update (cameraPosition: THREE.Vector3) {
    if (this.mesh) {
      this.mesh.position.copy(cameraPosition)
    }
  }

  dispose () {
    if (this.texture) {
      this.texture.dispose()
    }
    if (this.mesh) {
      this.mesh.geometry.dispose()
      ;(this.mesh.material as THREE.Material).dispose()
      this.scene.remove(this.mesh)
    }
  }
}
