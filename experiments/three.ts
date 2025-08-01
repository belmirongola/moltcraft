import * as THREE from 'three'
import globalTexture from 'mc-assets/dist/blocksAtlasLegacy.png'

// Import the renderBlockThree function
import { renderBlockThree } from '../renderer/viewer/lib/mesher/standaloneRenderer'

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

// Add grid helper for orientation
const gridHelper = new THREE.GridHelper(10, 10)
scene.add(gridHelper)

// Create shared material that will be used by all blocks
const sharedMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  transparent: true,
  alphaTest: 0.1,
  // wireframe: true // Add wireframe for debugging
})

// Create simple block models for testing
function createFullBlockModel(textureObj: any): any {
  return [[{
    elements: [{
      from: [0, 0, 0],
      to: [16, 16, 16],
      faces: {
        up: {
          texture: textureObj,
          uv: [0, 0, 16, 16]
        },
        down: {
          texture: textureObj,
          uv: [0, 0, 16, 16]
        },
        north: {
          texture: textureObj,
          uv: [0, 0, 16, 16]
        },
        south: {
          texture: textureObj,
          uv: [0, 0, 16, 16]
        },
        east: {
          texture: textureObj,
          uv: [0, 0, 16, 16]
        },
        west: {
          texture: textureObj,
          uv: [0, 0, 16, 16]
        }
      }
    }]
  }]]
}

function createHalfBlockModel(textureObj: any): any {
  return [[{
    elements: [{
      from: [0, 0, 0],
      to: [16, 8, 16], // Half height (8 instead of 16)
      faces: {
        up: {
          texture: textureObj,
          uv: [0, 0, 16, 16]
        },
        down: {
          texture: textureObj,
          uv: [0, 0, 16, 16]
        },
        north: {
          texture: textureObj,
          uv: [0, 0, 16, 8] // Half height UV
        },
        south: {
          texture: textureObj,
          uv: [0, 0, 16, 8] // Half height UV
        },
        east: {
          texture: textureObj,
          uv: [0, 0, 16, 8] // Half height UV
        },
        west: {
          texture: textureObj,
          uv: [0, 0, 16, 8] // Half height UV
        }
      }
    }]
  }]]
}

let currentFullBlockInstancedMesh: THREE.InstancedMesh | null = null
let currentHalfBlockInstancedMesh: THREE.InstancedMesh | null = null

async function createInstancedBlock() {
  try {
    // Clean up previous meshes if they exist
    if (currentFullBlockInstancedMesh) {
      scene.remove(currentFullBlockInstancedMesh)
      currentFullBlockInstancedMesh.geometry.dispose()
    }
    if (currentHalfBlockInstancedMesh) {
      scene.remove(currentHalfBlockInstancedMesh)
      currentHalfBlockInstancedMesh.geometry.dispose()
    }

    // Load the blocks atlas texture
    const textureLoader = new THREE.TextureLoader()
    const texture = await textureLoader.loadAsync(globalTexture)

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
      v: 2 * tileSize / atlasHeight,       // Top edge (third row)
      su: tileSize / atlasWidth,  // Width of one tile
      sv: tileSize / atlasHeight  // Height of one tile
    }

    console.log('Atlas size:', atlasWidth, 'x', atlasHeight)
    console.log('Calculated texture info:', textureInfo)

    // Create mock texture object that matches what the renderer expects
    const mockTexture = {
      u: textureInfo.u,
      v: textureInfo.v,
      su: textureInfo.su,
      sv: textureInfo.sv,
      debugName: 'test_texture'
    }

        // Create block models with the mock texture
    const fullBlockModel = createFullBlockModel(mockTexture)
    const halfBlockModel = createHalfBlockModel(mockTexture)

    // Mock data for the renderBlockThree function
    const mockBlock = undefined // No specific block data needed for this test
    const mockBiome = 'plains'
    const mockMcData = {} as any
    const mockVariants = []
    const mockNeighbors = {}

    // Render the full block
    const fullBlockGeometry = renderBlockThree(
      fullBlockModel,
      mockBlock,
      mockBiome,
      mockMcData,
      mockVariants,
      mockNeighbors
    )

    // Render the half block
    const halfBlockGeometry = renderBlockThree(
      halfBlockModel,
      mockBlock,
      mockBiome,
      mockMcData,
      mockVariants,
      mockNeighbors
    )

            // Create instanced mesh for full blocks
    currentFullBlockInstancedMesh = new THREE.InstancedMesh(fullBlockGeometry, sharedMaterial, 2) // Support 2 instances
    const matrix = new THREE.Matrix4()

    // First instance (full block)
    matrix.setPosition(-1.5, 0.5, 0.5)
    currentFullBlockInstancedMesh.setMatrixAt(0, matrix)

    // Second instance (full block)
    matrix.setPosition(1.5, 0.5, 0.5)
    currentFullBlockInstancedMesh.setMatrixAt(1, matrix)

    currentFullBlockInstancedMesh.count = 2
    currentFullBlockInstancedMesh.instanceMatrix.needsUpdate = true
    scene.add(currentFullBlockInstancedMesh)

    // Create instanced mesh for half blocks
    currentHalfBlockInstancedMesh = new THREE.InstancedMesh(halfBlockGeometry, sharedMaterial, 1) // Support 1 instance
    const halfMatrix = new THREE.Matrix4()

    // Half block instance
    halfMatrix.setPosition(0, 0.75, 0.5) // Positioned higher so top aligns with full blocks
    currentHalfBlockInstancedMesh.setMatrixAt(0, halfMatrix)

    currentHalfBlockInstancedMesh.count = 1
    currentHalfBlockInstancedMesh.instanceMatrix.needsUpdate = true
    scene.add(currentHalfBlockInstancedMesh)

    console.log('Instanced blocks created successfully')
    console.log('Full block geometry:', fullBlockGeometry)
    console.log('Half block geometry:', halfBlockGeometry)

  } catch (error) {
    console.error('Error creating instanced blocks:', error)

    // Fallback: create colored cubes
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshLambertMaterial({ color: 0xff0000, wireframe: true })
    const fallbackMesh = new THREE.Mesh(geometry, material)
    fallbackMesh.position.set(0, 0.5, 0.5)
    scene.add(fallbackMesh)

    console.log('Created fallback colored cube')
  }
}

// Create the instanced block
createInstancedBlock().then(() => {
  render()
})

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

  // Rotate camera around the center
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
