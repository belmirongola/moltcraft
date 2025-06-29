import * as THREE from 'three'
import { getLoadedImage } from 'mc-assets/dist/utils'
import { LoadedResourcesTransferrable, ResourcesManager } from '../../../src/resourcesManager'
import { WorldRendererThree } from './worldrendererThree'

// Type definition for texture info returned by AtlasParser
interface TextureInfo {
  u: number
  v: number
  width?: number
  height?: number
  su?: number
  sv?: number
}

// Type definition for atlas structure based on usage patterns in codebase
interface AtlasData {
  latest: {
    tileSize: number
    width: number
    height: number
    textures: Record<string, TextureInfo>
    suSv: number
  }
}

// Type definition for AtlasParser based on usage patterns in codebase
interface AtlasParserType {
  atlas: AtlasData
  latestImage?: string
  getTextureInfo: (name: string) => TextureInfo | null | undefined
}

export class FirstPersonEffects {
  private readonly fireSprite: THREE.Sprite
  private fireTextures: THREE.Texture[] = []
  private currentTextureIndex = 0
  private lastTextureUpdate = 0
  private readonly TEXTURE_UPDATE_INTERVAL = 200 // 5 times per second
  private readonly cameraGroup = new THREE.Group()
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
      color: new THREE.Color(1, 0.8, 0.4), // Slightly warm tint
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

    const resources = this.worldRenderer.resourcesManager.currentResources
    if (!resources) {
      console.warn('FirstPersonEffects: No resources available for loading fire textures')
      return
    }

    // Cast resourcesManager to access blocksAtlasParser using type assertion
    const resourcesManager = this.worldRenderer.resourcesManager as any
    const blocksAtlasParser = resourcesManager.blocksAtlasParser as AtlasParserType
    if (!blocksAtlasParser?.atlas?.latest) {
      console.warn('FirstPersonEffects: Blocks atlas parser not available')
      return
    }

    // Load all fire animation frames (fire_0, fire_1, etc.)
    for (let i = 0; i < 32; i++) {
      try {
        const textureInfo = blocksAtlasParser.getTextureInfo(`fire_${i}`)
        if (!textureInfo) break // Stop when no more frames available

        const { atlas } = blocksAtlasParser
        const defaultSize = atlas.latest.tileSize || 16
        const { width: imageWidth = 256, height: imageHeight = 256 } = atlas.latest

        const canvas = new OffscreenCanvas(
          textureInfo.width ?? defaultSize,
          textureInfo.height ?? defaultSize
        )
        const ctx = canvas.getContext('2d')
        if (ctx && blocksAtlasParser.latestImage) {
          const image = await getLoadedImage(blocksAtlasParser.latestImage)
          const sourceX = textureInfo.u * imageWidth
          const sourceY = textureInfo.v * imageHeight
          const sourceWidth = textureInfo.width ?? defaultSize
          const sourceHeight = textureInfo.height ?? defaultSize

          ctx.drawImage(
            image,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            sourceWidth,
            sourceHeight
          )

          const blob = await canvas.convertToBlob()
          const url = URL.createObjectURL(blob)
          fireImageBase64.push(url)
        }
      } catch (error) {
        console.warn(`FirstPersonEffects: Error loading fire texture ${i}:`, error)
        break
      }
    }

    // Create textures from base64 images
    this.fireTextures = fireImageBase64.map(base64 => {
      const texture = new THREE.TextureLoader().load(base64)
      texture.minFilter = THREE.NearestFilter
      texture.magFilter = THREE.NearestFilter
      return texture
    })

    console.log(`FirstPersonEffects: Loaded ${this.fireTextures.length} fire animation frames`)
  }

  setIsOnFire (isOnFire: boolean) {
    this.fireSprite.visible = isOnFire
  }

  update () {
    if (!this.fireSprite.visible || this.fireTextures.length === 0) return

    const now = Date.now()
    if (now - this.lastTextureUpdate >= this.TEXTURE_UPDATE_INTERVAL) {
      this.currentTextureIndex = (this.currentTextureIndex + 1) % this.fireTextures.length
      this.fireSprite.material.map = this.fireTextures[this.currentTextureIndex]
      this.lastTextureUpdate = now
    }

    // Update camera group position and rotation
    const camera = this.worldRenderer.camera
    if (this.updateCameraGroup && camera) {
      this.cameraGroup.position.copy(camera.position)
      this.cameraGroup.rotation.copy(camera.rotation)
    }

    // Position fire overlay in front of camera but fill the screen like in Minecraft
    const distance = 0.1 // Very close to camera for overlay effect
    this.effectsGroup.position.set(0, 0, -distance)

    // Scale sprite to fill most of the screen like Minecraft's fire overlay
    const { innerWidth, innerHeight } = window
    const aspect = innerWidth / innerHeight
    const { fov } = camera
    const fovRadians = (fov * Math.PI) / 180
    const height = 2 * Math.tan(fovRadians / 2) * distance
    const width = height * aspect

    // Make fire overlay larger to create immersive burning effect
    this.fireSprite.scale.set(width * 1.8, height * 1.8, 1)

    // Slightly offset the fire to the bottom of the screen like in Minecraft
    this.fireSprite.position.set(0, -height * 0.3, 0)
  }
}
