import { loadSkinToCanvas } from 'skinview-utils'
import * as THREE from 'three'
import stevePng from 'mc-assets/dist/other-textures/latest/entity/player/wide/steve.png'
import { getLoadedImage } from 'mc-assets/dist/utils'

export const loadThreeJsTextureFromUrlSync = (imageUrl: string) => {
  const texture = new THREE.Texture()
  const promise = getLoadedImage(imageUrl).then(image => {
    texture.image = image
    texture.needsUpdate = true
    return texture
  })
  return {
    texture,
    promise
  }
}

export const createCanvas = (width: number, height: number): OffscreenCanvas => {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas as unknown as OffscreenCanvas // todo-low
}

export const loadThreeJsTextureFromUrl = async (imageUrl: string) => {
  const loaded = new THREE.TextureLoader().loadAsync(imageUrl)
  return loaded
}
export const loadThreeJsTextureFromBitmap = (image: ImageBitmap) => {
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  const texture = new THREE.Texture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

export const stevePngUrl = stevePng
export const steveTexture = loadThreeJsTextureFromUrl(stevePngUrl)


export async function loadImageFromUrl (imageUrl: string): Promise<ImageBitmap> {
  const response = await fetch(imageUrl)
  const blob = await response.blob()
  return createImageBitmap(blob)
}

const config = {
  apiEnabled: true,
}

export const setSkinsConfig = (newConfig: Partial<typeof config>) => {
  Object.assign(config, newConfig)
}

export async function loadSkinFromUsername (username: string, type: 'skin' | 'cape'): Promise<string | undefined> {
  if (!config.apiEnabled) return

  if (type === 'cape') return
  const url = `https://playerdb.co/api/player/minecraft/${username}`
  const response = await fetch(url)
  if (!response.ok) return

  const data: {
    data: {
      player: {
        skin_texture: string
      }
    }
  } = await response.json()
  return data.data.player.skin_texture
}

export const parseSkinTexturesValue = (value: string) => {
  const decodedData: {
    textures: {
      SKIN: {
        url: string
      }
    }
  } = JSON.parse(Buffer.from(value, 'base64').toString())
  return decodedData.textures?.SKIN?.url
}

export async function loadSkinImage (skinUrl: string): Promise<{ canvas: OffscreenCanvas, image: ImageBitmap }> {
  if (!skinUrl.startsWith('data:')) {
    skinUrl = await fetchAndConvertBase64Skin(skinUrl.replace('http://', 'https://'))
  }

  const image = await loadImageFromUrl(skinUrl)
  const skinCanvas = createCanvas(64, 64)
  loadSkinToCanvas(skinCanvas, image)
  return { canvas: skinCanvas, image }
}

const fetchAndConvertBase64Skin = async (skinUrl: string) => {
  const response = await fetch(skinUrl, { })
  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return `data:image/png;base64,${base64}`
}
