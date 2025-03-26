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
      alphaTest: 0.1
    })

    this.fireSprite = new THREE.Sprite(spriteMaterial)
    // this.fireSprite.visible = false
    this.effectsGroup.add(this.fireSprite)

    this.worldRenderer.onRender.push(() => {
      this.update()
    })
  }

  async loadTextures () {
    const fireImageBase64 = [] as string[]

    const { blocksAtlasParser } = (this.worldRenderer.resourcesManager.currentResources!)
    const textureInfo = blocksAtlasParser.getTextureInfo('fire_0') as { u: number, v: number, width?: number, height?: number }
    if (textureInfo) {
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

    // Position fire in front of camera
    const distance = 0.5 // Distance in front of camera
    this.effectsGroup.position.set(0, 0, -distance)

    // Scale sprite to take full width while preserving aspect ratio
    const aspect = window.innerWidth / window.innerHeight
    const width = 2 * Math.tan(camera.fov * Math.PI / 360) * distance
    const height = width / aspect
    this.fireSprite.scale.set(width, height, 1)
  }
}
