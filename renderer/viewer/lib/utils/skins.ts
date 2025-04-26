import { loadSkinToCanvas } from 'skinview-utils'
import * as THREE from 'three'
import stevePng from 'mc-assets/dist/other-textures/latest/entity/player/wide/steve.png'

// eslint-disable-next-line unicorn/prefer-export-from
export const stevePngUrl = stevePng
export const steveTexture = new THREE.TextureLoader().loadAsync(stevePng)

export async function loadImageFromUrl (imageUrl: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = imageUrl
  await new Promise<void>(resolve => {
    img.onload = () => resolve()
  })
  return img
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

export async function loadSkinImage (skinUrl: string): Promise<{ canvas: HTMLCanvasElement, image: HTMLImageElement }> {
  if (!skinUrl.startsWith('data:')) {
    skinUrl = await fetchAndConvertBase64Skin(skinUrl.replace('http://', 'https://'))
  }

  const image = await loadImageFromUrl(skinUrl)
  const skinCanvas = document.createElement('canvas')
  loadSkinToCanvas(skinCanvas, image)
  return { canvas: skinCanvas, image }
}

const fetchAndConvertBase64Skin = async (skinUrl: string) => {
  const response = await fetch(skinUrl, { })
  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return `data:image/png;base64,${base64}`
}
