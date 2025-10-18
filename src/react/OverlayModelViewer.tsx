import { proxy, useSnapshot, subscribe } from 'valtio'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { applySkinToPlayerObject, createPlayerObject, PlayerObjectType } from '../../renderer/viewer/lib/createPlayerObject'
import { currentScaling } from '../scaleInterface'
import { activeModalStack } from '../globalState'

THREE.ColorManagement.enabled = false

export const modelViewerState = proxy({
  model: undefined as undefined | {
    models?: string[] // Array of model URLs (URL itself is the cache key)
    steveModelSkin?: string
    debug?: boolean
    // absolute positioning
    positioning: {
      windowWidth: number
      windowHeight: number
      x: number
      y: number
      width: number
      height: number
      scaled?: boolean
      onlyInitialScale?: boolean
      followCursor?: boolean
    }
    modelCustomization?: { [modelUrl: string]: { color?: string, opacity?: number, metalness?: number, roughness?: number } }
    resetRotationOnReleae?: boolean
    continiousRender?: boolean
    alwaysRender?: boolean
  }
})
globalThis.modelViewerState = modelViewerState

// Global debug function to get camera and model values
globalThis.getModelViewerValues = () => {
  const scene = globalThis.sceneRef?.current
  if (!scene) return null

  const { camera, playerObject } = scene
  if (!playerObject) return null

  const wrapper = playerObject.parent
  if (!wrapper) return null

  const box = new THREE.Box3().setFromObject(wrapper)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  return {
    camera: {
      position: camera.position.clone(),
      fov: camera.fov,
      aspect: camera.aspect
    },
    model: {
      position: wrapper.position.clone(),
      rotation: wrapper.rotation.clone(),
      scale: wrapper.scale.clone(),
      size,
      center
    },
    cursor: {
      position: globalThis.cursorPosition || { x: 0, y: 0 },
      normalized: globalThis.cursorPosition ? {
        x: globalThis.cursorPosition.x * 2 - 1,
        y: globalThis.cursorPosition.y * 2 - 1
      } : { x: 0, y: 0 }
    },
    visibleArea: {
      height: 2 * Math.tan(camera.fov * Math.PI / 180 / 2) * camera.position.z,
      width: 2 * Math.tan(camera.fov * Math.PI / 180 / 2) * camera.position.z * camera.aspect
    }
  }
}

subscribe(activeModalStack, () => {
  if (!modelViewerState.model || !modelViewerState.model?.alwaysRender) {
    return
  }
  if (activeModalStack.length === 0) {
    modelViewerState.model = undefined
  }
})

export default () => {
  const { model } = useSnapshot(modelViewerState)
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer
    controls: OrbitControls
    playerObject?: PlayerObjectType
    dispose: () => void
  }>()
  const initialScale = useMemo(() => {
    return currentScaling.scale
  }, [])
  globalThis.sceneRef = sceneRef

  // Cursor following state
  const cursorPosition = useRef({ x: 0, y: 0 })
  const isFollowingCursor = useRef(false)

  // Model management state
  const loadedModels = useRef<Map<string, THREE.Object3D>>(new Map())
  const modelLoaders = useRef<Map<string, GLTFLoader | OBJLoader>>(new Map())

  // Model management functions
  const loadModel = (modelUrl: string) => {
    if (loadedModels.current.has(modelUrl)) return // Already loaded

    const isGLTF = modelUrl.toLowerCase().endsWith('.gltf') || modelUrl.toLowerCase().endsWith('.glb')
    const loader = isGLTF ? new GLTFLoader() : new OBJLoader()
    modelLoaders.current.set(modelUrl, loader)

    const onLoad = (object: THREE.Object3D) => {
      // Apply customization if available and enable shadows
      const customization = model?.modelCustomization?.[modelUrl]
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Enable shadow casting and receiving for all meshes
          child.castShadow = true
          child.receiveShadow = true

          if (child.material && customization) {
            const material = child.material as THREE.MeshStandardMaterial
            if (customization.color) {
              material.color.setHex(parseInt(customization.color.replace('#', ''), 16))
            }
            if (customization.opacity !== undefined) {
              material.opacity = customization.opacity
              material.transparent = customization.opacity < 1
            }
            if (customization.metalness !== undefined) {
              material.metalness = customization.metalness
            }
            if (customization.roughness !== undefined) {
              material.roughness = customization.roughness
            }
          }
        }
      })

      // Center and scale model
      const box = new THREE.Box3().setFromObject(object)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 2 / maxDim
      object.scale.setScalar(scale)
      object.position.sub(center.multiplyScalar(scale))

      // Store the model using URL as key
      loadedModels.current.set(modelUrl, object)
      sceneRef.current?.scene.add(object)

      // Trigger render
      if (sceneRef.current) {
        setTimeout(() => {
          const render = () => sceneRef.current?.renderer.render(sceneRef.current.scene, sceneRef.current.camera)
          render()
        }, 0)
      }
    }

    if (isGLTF) {
      (loader as GLTFLoader).load(modelUrl, (gltf) => {
        onLoad(gltf.scene)
      })
    } else {
      (loader as OBJLoader).load(modelUrl, onLoad)
    }
  }

  const removeModel = (modelUrl: string) => {
    const model = loadedModels.current.get(modelUrl)
    if (model) {
      sceneRef.current?.scene.remove(model)
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.material) {
            if (Array.isArray(child.material)) {
              for (const mat of child.material) {
                mat.dispose()
              }
            } else {
              child.material.dispose()
            }
          }
          if (child.geometry) {
            child.geometry.dispose()
          }
        }
      })
      loadedModels.current.delete(modelUrl)
    }
    modelLoaders.current.delete(modelUrl)
  }

  // Subscribe to model changes
  useEffect(() => {
    if (!modelViewerState.model?.models) return

    const modelsChanged = () => {
      const currentModels = modelViewerState.model?.models || []
      const currentModelUrls = new Set(currentModels)
      const loadedModelUrls = new Set(loadedModels.current.keys())

      // Remove models that are no longer in the state
      for (const modelUrl of loadedModelUrls) {
        if (!currentModelUrls.has(modelUrl)) {
          removeModel(modelUrl)
        }
      }

      // Add new models
      for (const modelUrl of currentModels) {
        if (!loadedModelUrls.has(modelUrl)) {
          loadModel(modelUrl)
        }
      }
    }
    const unsubscribe = subscribe(modelViewerState.model.models, modelsChanged)

    let unmounted = false
    setTimeout(() => {
      if (unmounted) return
      modelsChanged()
    })

    return () => {
      unmounted = true
      unsubscribe?.()
    }
  }, [model?.models])

  useEffect(() => {
    if (!model || !containerRef.current) return

    // Setup scene
    const scene = new THREE.Scene()
    scene.background = null // Transparent background

    // Setup camera with optimal settings for player model viewing
    const camera = new THREE.PerspectiveCamera(
      50, // Reduced FOV for better model viewing
      model.positioning.width / model.positioning.height,
      0.1,
      1000
    )
    camera.position.set(0, 0, 3) // Position camera to view player model optimally

    // Setup renderer with pixel density awareness
    const renderer = new THREE.WebGLRenderer({ alpha: true })
    let scale = window.devicePixelRatio || 1
    if (modelViewerState.model?.positioning.scaled) {
      scale *= currentScaling.scale
    }
    renderer.setPixelRatio(scale)
    renderer.setSize(model.positioning.width, model.positioning.height)

    // Enable shadow rendering for depth and realism
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap // Soft shadows for better quality
    renderer.shadowMap.autoUpdate = true

    containerRef.current.appendChild(renderer.domElement)

    // Setup controls
    const controls = new OrbitControls(camera, renderer.domElement)
    // controls.enableZoom = false
    // controls.enablePan = false
    controls.minPolarAngle = Math.PI / 2 // Lock vertical rotation
    controls.maxPolarAngle = Math.PI / 2
    controls.enableDamping = true
    controls.dampingFactor = 0.05

    // Add ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xff_ff_ff, 0.4) // Reduced intensity to allow shadows
    scene.add(ambientLight)

    // Add directional light for shadows and depth (similar to Minecraft inventory lighting)
    const directionalLight = new THREE.DirectionalLight(0xff_ff_ff, 0.6)
    directionalLight.position.set(2, 2, 2) // Position light from top-right-front
    directionalLight.target.position.set(0, 0, 0) // Point towards center of scene

    // Configure shadow properties for optimal quality
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048 // High resolution shadow map
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.1
    directionalLight.shadow.camera.far = 10
    directionalLight.shadow.camera.left = -3
    directionalLight.shadow.camera.right = 3
    directionalLight.shadow.camera.top = 3
    directionalLight.shadow.camera.bottom = -3
    directionalLight.shadow.bias = -0.0001 // Reduce shadow acne

    scene.add(directionalLight)
    scene.add(directionalLight.target)

    // Cursor following function
    const updatePlayerLookAt = () => {
      if (!isFollowingCursor.current || !sceneRef.current?.playerObject) return

      const { playerObject } = sceneRef.current
      const { x, y } = cursorPosition.current

      // Convert 0-1 cursor position to normalized coordinates (-1 to 1)
      const normalizedX = x * 2 - 1
      const normalizedY = y * 2 - 1 // Inverted: top of screen = negative pitch, bottom = positive pitch

      // Calculate head rotation based on cursor position
      // Limit head movement to realistic angles
      const maxHeadYaw = Math.PI / 3 // 60 degrees
      const maxHeadPitch = Math.PI / 4 // 45 degrees

      const headYaw = normalizedX * maxHeadYaw
      const headPitch = normalizedY * maxHeadPitch

      // Apply head rotation with smooth interpolation
      const lerpFactor = 0.1 // Smooth interpolation factor
      playerObject.skin.head.rotation.y = THREE.MathUtils.lerp(
        playerObject.skin.head.rotation.y,
        headYaw,
        lerpFactor
      )
      playerObject.skin.head.rotation.x = THREE.MathUtils.lerp(
        playerObject.skin.head.rotation.x,
        headPitch,
        lerpFactor
      )

      // Apply slight body rotation for more natural movement
      const bodyYaw = headYaw * 0.3 // Body follows head but with less rotation
      playerObject.rotation.y = THREE.MathUtils.lerp(
        playerObject.rotation.y,
        bodyYaw,
        lerpFactor * 0.5 // Slower body movement
      )

      render()
    }

    // Render function
    const render = () => {
      renderer.render(scene, camera)
    }

    // Setup animation/render strategy
    if (model.continiousRender) {
      // Continuous animation loop
      const animate = () => {
        requestAnimationFrame(animate)
        render()
      }
      animate()
    } else {
      // Render only on camera movement
      controls.addEventListener('change', render)
      // Initial render
      render()
      // Render after model loads
      if (model.steveModelSkin !== undefined) {
        // Create player model
        const { playerObject, wrapper } = createPlayerObject({
          scale: 1 // Start with base scale, will adjust below
        })

        // Enable shadows for player object
        wrapper.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        // Calculate proper scale and positioning for camera view
        const box = new THREE.Box3().setFromObject(wrapper)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())

        // Calculate scale to fit within camera view (considering FOV and distance)
        const cameraDistance = camera.position.z
        const fov = camera.fov * Math.PI / 180 // Convert to radians
        const visibleHeight = 2 * Math.tan(fov / 2) * cameraDistance
        const visibleWidth = visibleHeight * (model.positioning.width / model.positioning.height)

        const scaleFactor = Math.min(
          (visibleHeight) / size.y,
          (visibleWidth) / size.x
        )

        wrapper.scale.multiplyScalar(scaleFactor)

        // Center the player object
        wrapper.position.sub(center.multiplyScalar(scaleFactor))

        // Rotate to face camera (remove the default 180° rotation)
        wrapper.rotation.set(0, 0, 0)

        scene.add(wrapper)
        sceneRef.current = {
          ...sceneRef.current!,
          playerObject
        }

        void applySkinToPlayerObject(playerObject, model.steveModelSkin).then(() => {
          setTimeout(render, 0)
        })

        // Set up cursor following if enabled
        if (model.positioning.followCursor) {
          isFollowingCursor.current = true
        }
      }
    }

    // Window cursor tracking for followCursor
    let lastCursorUpdate = 0
    let waitingRender = false
    const handleWindowPointerMove = (event: PointerEvent) => {
      if (!model.positioning.followCursor) return

      // Track cursor position as 0-1 across the entire window
      const newPosition = {
        x: event.clientX / window.innerWidth,
        y: event.clientY / window.innerHeight
      }
      cursorPosition.current = newPosition
      globalThis.cursorPosition = newPosition // Expose for debug
      lastCursorUpdate = Date.now()
      updatePlayerLookAt()
      if (!waitingRender) {
        requestAnimationFrame(() => {
          render()
          waitingRender = false
        })
        waitingRender = true
      }
    }

    // Add window event listeners
    if (model.positioning.followCursor) {
      window.addEventListener('pointermove', handleWindowPointerMove)
      isFollowingCursor.current = true
    }

    // Store refs for cleanup
    sceneRef.current = {
      ...sceneRef.current!,
      scene,
      camera,
      renderer,
      controls,
      dispose () {
        if (!model.continiousRender) {
          controls.removeEventListener('change', render)
        }
        if (model.positioning.followCursor) {
          window.removeEventListener('pointermove', handleWindowPointerMove)
        }

        // Clean up loaded models
        for (const [modelUrl, model] of loadedModels.current) {
          scene.remove(model)
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (child.material) {
                if (Array.isArray(child.material)) {
                  for (const mat of child.material) {
                    mat.dispose()
                  }
                } else {
                  child.material.dispose()
                }
              }
              if (child.geometry) {
                child.geometry.dispose()
              }
            }
          })
        }
        loadedModels.current.clear()
        modelLoaders.current.clear()

        const playerObject = sceneRef.current?.playerObject
        if (playerObject?.skin.map) {
          (playerObject.skin.map as unknown as THREE.Texture).dispose()
        }
        renderer.dispose()
        renderer.domElement?.remove()
      }
    }

    return () => {
      sceneRef.current?.dispose()
    }
  }, [model])

  if (!model) return null

  const { x, y, width, height, scaled, onlyInitialScale } = model.positioning
  const { windowWidth } = model.positioning
  const { windowHeight } = model.positioning
  const scaleValue = onlyInitialScale ? initialScale : 'var(--guiScale)'

  return (
    <div
      className='overlay-model-viewer-container'
      style={{
        zIndex: 100,
        position: 'fixed',
        inset: 0,
        width: '100dvw',
        height: '100dvh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        transform: scaled ? `scale(${scaleValue})` : 'none',
        pointerEvents: 'none',
      }}
    >
      <div
        className='overlay-model-viewer-window'
        style={{
          width: windowWidth,
          height: windowHeight,
          position: 'relative',
          pointerEvents: 'none',
        }}
      >
        <div
          ref={containerRef}
          className='overlay-model-viewer'
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width,
            height,
            pointerEvents: 'auto',
            backgroundColor: model.debug ? 'red' : undefined,
          }}
        />
      </div>
    </div>
  )
}
