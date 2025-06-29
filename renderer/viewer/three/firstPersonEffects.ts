import * as THREE from 'three'
import { getLoadedImage } from 'mc-assets/dist/utils'
import { WorldRendererThree } from './worldrendererThree'

export class FirstPersonEffects {
  private readonly fireSprite: THREE.Sprite | null = null
  private fireTextures: THREE.Texture[] = []
  private currentTextureIndex = 0
  private lastTextureUpdate = 0
  private readonly TEXTURE_UPDATE_INTERVAL = 200 // 5 times per second
  private readonly cameraGroup = new THREE.Mesh()
  private readonly effectsGroup = new THREE.Group()
  updateCameraGroup = true

  constructor (private readonly worldRenderer: WorldRendererThree) {
    this.worldRenderer.scene.add(this.cameraGroup)
    this.cameraGroup.add(this.effectsGroup)

    if (this.worldRenderer.resourcesManager.currentResources) {
      void this.loadTextures()
    }
    this.worldRenderer.resourcesManager.on('assetsTexturesUpdated', () => {
      void this.loadTextures()
    })

    // Create sprite
    const spriteMaterial = new THREE.SpriteMaterial({
      map: null,
      transparent: true,
      alphaTest: 0.1,
      blending: THREE.AdditiveBlending, // Makes fire glow effect
      depthTest: false, // Ensures fire always renders in front
      depthWrite: false,
      color: new THREE.Color(1.0, 0.8, 0.4), // Slightly warm tint
    })

    this.fireSprite = new THREE.Sprite(spriteMaterial)
    this.fireSprite.visible = false
    this.effectsGroup.add(this.fireSprite)

    this.worldRenderer.onRender.push(() => {
      this.update()
    })
  }

  async loadTextures () {
    const fireImageBase64 = [] as string[]

    const { blocksAtlasParser } = (this.worldRenderer.resourcesManager.currentResources!)
    
    // Load all fire animation frames (fire_0, fire_1, etc.)
    for (let i = 0; i < 32; i++) {
      const textureInfo = blocksAtlasParser.getTextureInfo(`fire_${i}`) as { u: number, v: number, width?: number, height?: number } | null
      if (!textureInfo) break // Stop when no more frames available
      
      const defaultSize = blocksAtlasParser.atlas.latest.tileSize
      const imageWidth = blocksAtlasParser.atlas.latest.width
      const imageHeight = blocksAtlasParser.atlas.latest.height
      const canvas = new OffscreenCanvas(textureInfo.width ?? defaultSize, textureInfo.height ?? defaultSize)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const image = await getLoadedImage(blocksAtlasParser.latestImage)
        ctx.drawImage(image, textureInfo.u * imageWidth, textureInfo.v * imageHeight, textureInfo.width ?? defaultSize, textureInfo.height ?? defaultSize, 0, 0, textureInfo.width ?? defaultSize, textureInfo.height ?? defaultSize)
        const blob = await canvas.convertToBlob()
        const url = URL.createObjectURL(blob)
        fireImageBase64.push(url)
      }
    }

    // Create textures from base64 images
    this.fireTextures = fireImageBase64.map(base64 => {
      const texture = new THREE.TextureLoader().load(base64)
      texture.minFilter = THREE.NearestFilter
      texture.magFilter = THREE.NearestFilter
      return texture
    })
    
    console.log(`Loaded ${this.fireTextures.length} fire animation frames`)
  }

  setIsOnFire (isOnFire: boolean) {
    if (this.fireSprite) {
      this.fireSprite.visible = isOnFire
    }
  }

  update () {
    if (!this.fireSprite?.visible || this.fireTextures.length === 0) return

    const now = Date.now()
    if (now - this.lastTextureUpdate >= this.TEXTURE_UPDATE_INTERVAL) {
      this.currentTextureIndex = (this.currentTextureIndex + 1) % this.fireTextures.length;
      (this.fireSprite.material).map = this.fireTextures[this.currentTextureIndex]
      this.lastTextureUpdate = now
    }

    // Update camera group position and rotation
    const { camera } = this.worldRenderer
    if (this.updateCameraGroup) {
      this.cameraGroup.position.copy(camera.position)
      this.cameraGroup.rotation.copy(camera.rotation)
    }

    // Position fire overlay in front of camera but fill the screen like in Minecraft
    const distance = 0.1 // Very close to camera for overlay effect
    this.effectsGroup.position.set(0, 0, -distance)

    // Scale sprite to fill most of the screen like Minecraft's fire overlay
    const aspect = window.innerWidth / window.innerHeight
    const fovRadians = (camera.fov * Math.PI) / 180
    const height = 2 * Math.tan(fovRadians / 2) * distance
    const width = height * aspect
    
    // Make fire overlay larger to create immersive burning effect
    this.fireSprite.scale.set(width * 1.8, height * 1.8, 1)
    
    // Slightly offset the fire to the bottom of the screen like in Minecraft
    this.fireSprite.position.set(0, -height * 0.3, 0)
  }
}
