import * as THREE from 'three'
import globalTexture from 'mc-assets/dist/blocksAtlasLegacy.png'

// Create scene, camera and renderer
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

// Position camera
camera.position.set(3, 3, 3)
camera.lookAt(0, 0, 0)

// Dark background
scene.background = new THREE.Color(0x333333)

// Add some lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
scene.add(ambientLight)
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4)
directionalLight.position.set(1, 1, 1)
scene.add(directionalLight)

// Create shared material that will be used by all blocks
const sharedMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  transparent: true,
  alphaTest: 0.1
})

function createCustomGeometry(textureInfo: { u: number, v: number, su: number, sv: number }): THREE.BufferGeometry {
  // Create custom geometry with specific UV coordinates for this block type
  const geometry = new THREE.BoxGeometry(1, 1, 1)

  // Get UV attribute
  const uvAttribute = geometry.getAttribute('uv') as THREE.BufferAttribute
  const uvs = uvAttribute.array as Float32Array

  console.log('Original UVs:', Array.from(uvs))
  console.log('Texture info:', textureInfo)

  // BoxGeometry has 6 faces, each with 2 triangles (4 vertices), so 24 UV pairs total
  // Apply the same texture to all faces for simplicity
  for (let i = 0; i < uvs.length; i += 2) {
    const u = uvs[i]
    const v = uvs[i + 1]

    // Map from 0-1 to the specific texture region in the atlas
    uvs[i] = textureInfo.u + u * textureInfo.su
    uvs[i + 1] = textureInfo.v + v * textureInfo.sv
  }

  console.log('Modified UVs:', Array.from(uvs))
  uvAttribute.needsUpdate = true
  return geometry
}

let currentInstancedMesh: THREE.InstancedMesh | null = null
let currentRefCube: THREE.Mesh | null = null

async function createInstancedBlock() {
  try {
    // Clean up previous meshes if they exist
    if (currentInstancedMesh) {
      scene.remove(currentInstancedMesh)
      currentInstancedMesh.geometry.dispose()
    }
    if (currentRefCube) {
      scene.remove(currentRefCube)
      currentRefCube.geometry.dispose()
    }

    // Load the blocks atlas texture
    const textureLoader = new THREE.TextureLoader()
    const texture = await new Promise<THREE.Texture>((resolve, reject) => {
      textureLoader.load(
        globalTexture,
        resolve,
        undefined,
        reject
      )
    })

    // Configure texture for pixel art
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestFilter
    texture.generateMipmaps = false
    texture.flipY = false

    // Set the texture on our shared material
    sharedMaterial.map = texture
    sharedMaterial.needsUpdate = true

    console.log('Texture loaded:', texture.image.width, 'x', texture.image.height)

    // Calculate UV coordinates for the first tile (top-left, 16x16)
    const atlasWidth = texture.image.width
    const atlasHeight = texture.image.height
    const tileSize = 16

    const textureInfo = {
      u: 0 / atlasWidth,        // Left edge (first column)
      v: 2 * tileSize / atlasHeight,       // Top edge (first row)
      su: tileSize / atlasWidth,  // Width of one tile
      sv: tileSize / atlasHeight  // Height of one tile
    }

    console.log('Atlas size:', atlasWidth, 'x', atlasHeight)
    console.log('Calculated texture info:', textureInfo)

    // Create custom geometry with proper UV mapping
    const geometry = createCustomGeometry(textureInfo)

    // Create instanced mesh using shared material
    currentInstancedMesh = new THREE.InstancedMesh(geometry, sharedMaterial, 1)
    const matrix = new THREE.Matrix4()
    matrix.setPosition(0.5, 0.5, 0.5) // Offset by +0.5 on each axis
    currentInstancedMesh.setMatrixAt(0, matrix)
    currentInstancedMesh.count = 1
    currentInstancedMesh.instanceMatrix.needsUpdate = true
    scene.add(currentInstancedMesh)

    // Reference non-instanced cube using same material
    currentRefCube = new THREE.Mesh(geometry, sharedMaterial)
    currentRefCube.position.set(2.5, 0.5, 0.5) // Offset by +0.5 on each axis
    scene.add(currentRefCube)

    console.log('Instanced block created successfully')

  } catch (error) {
    console.error('Error creating instanced block:', error)

    // Fallback: create a colored cube
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshLambertMaterial({ color: 0xff0000 })
    currentRefCube = new THREE.Mesh(geometry, material)
    scene.add(currentRefCube)
    console.log('Created fallback colored cube')
  }
}

// Create the instanced block
createInstancedBlock()

// Simple render loop (no animation)
function render() {
  renderer.render(scene, camera)
}

// Add mouse controls for better viewing
let mouseDown = false
let mouseX = 0
let mouseY = 0

renderer.domElement.addEventListener('mousedown', (event) => {
  mouseDown = true
  mouseX = event.clientX
  mouseY = event.clientY
})

renderer.domElement.addEventListener('mousemove', (event) => {
  if (!mouseDown) return

  const deltaX = event.clientX - mouseX
  const deltaY = event.clientY - mouseY

  // Rotate camera around the cube
  const spherical = new THREE.Spherical()
  spherical.setFromVector3(camera.position)
  spherical.theta -= deltaX * 0.01
  spherical.phi += deltaY * 0.01
  spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi))

  camera.position.setFromSpherical(spherical)
  camera.lookAt(0, 0, 0)

  mouseX = event.clientX
  mouseY = event.clientY

  render()
})

renderer.domElement.addEventListener('mouseup', () => {
  mouseDown = false
})

// Add button to recreate blocks (for testing)
const button = document.createElement('button')
button.textContent = 'Recreate Blocks'
button.style.position = 'fixed'
button.style.top = '10px'
button.style.left = '10px'
button.addEventListener('click', () => {
  createInstancedBlock()
  render()
})
document.body.appendChild(button)

// Initial render
render()
