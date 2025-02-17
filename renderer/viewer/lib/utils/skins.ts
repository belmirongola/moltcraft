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

export function getLookupUrl (username: string, type: 'skin' | 'cape'): string {
  return `https://mulv.tycrek.dev/api/lookup?username=${username}&type=${type}`
}

export async function loadSkinImage (skinUrl: string): Promise<{ canvas: HTMLCanvasElement, image: HTMLImageElement }> {
  const image = await loadImageFromUrl(skinUrl)
  const skinCanvas = document.createElement('canvas')
  loadSkinToCanvas(skinCanvas, image)
  return { canvas: skinCanvas, image }
}
