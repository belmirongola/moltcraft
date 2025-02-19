import * as THREE from 'three'

let textureCache: Record<string, THREE.Texture> = {}
let imagesPromises: Record<string, Promise<THREE.Texture>> = {}

export async function loadTexture (texture: string, cb: (texture: THREE.Texture) => void, onLoad?: () => void): Promise<void> {
  const cached = textureCache[texture]
  if (!cached) {
    const { promise, resolve } = Promise.withResolvers<THREE.Texture>()
    textureCache[texture] = new THREE.TextureLoader().load(texture, resolve)
    imagesPromises[texture] = promise
  }

  cb(textureCache[texture])
  void imagesPromises[texture].then(() => {
    onLoad?.()
  })
}

export const clearTextureCache = () => {
  textureCache = {}
  imagesPromises = {}
}

export const loadScript = async function (scriptSrc: string): Promise<HTMLScriptElement> {
  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`)
  if (existingScript) {
    return existingScript
  }

  return new Promise((resolve, reject) => {
    const scriptElement = document.createElement('script')
    scriptElement.src = scriptSrc
    scriptElement.async = true

    scriptElement.addEventListener('load', () => {
      resolve(scriptElement)
    })

    scriptElement.onerror = (error) => {
      reject(new Error(typeof error === 'string' ? error : (error as any).message))
      scriptElement.remove()
    }

    document.head.appendChild(scriptElement)
  })
}
