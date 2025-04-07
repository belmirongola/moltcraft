import * as THREE from 'three'
import Stats from 'stats.js'
import StatsGl from 'stats-gl'
import * as tween from '@tweenjs/tween.js'
import { GraphicsBackendConfig, GraphicsInitOptions } from '../../../src/appViewer'

export class DocumentRenderer {
  readonly canvas = document.createElement('canvas')
  readonly renderer: THREE.WebGLRenderer
  private animationFrameId?: number
  private lastRenderTime = 0
  private previousWindowWidth = window.innerWidth
  private previousWindowHeight = window.innerHeight
  private renderedFps = 0
  private fpsInterval: any
  private readonly stats: TopRightStats
  private paused = false
  disconnected = false
  preRender = () => { }
  render = (sizeChanged: boolean) => { }
  postRender = () => { }
  sizeChanged = () => { }
  droppedFpsPercentage: number
  config: GraphicsBackendConfig
  onRender = [] as Array<(sizeChanged: boolean) => void>

  constructor (initOptions: GraphicsInitOptions) {
    this.config = initOptions.config

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        preserveDrawingBuffer: true,
        logarithmicDepthBuffer: true,
        powerPreference: this.config.powerPreference
      })
    } catch (err) {
      initOptions.displayCriticalError(new Error(`Failed to create WebGL context, not possible to render (restart browser): ${err.message}`))
      throw err
    }
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    this.updatePixelRatio()
    this.updateSize()
    this.addToPage()

    this.stats = new TopRightStats(this.canvas, this.config.statsVisible)

    this.setupFpsTracking()
    this.startRenderLoop()
  }

  updatePixelRatio () {
    let pixelRatio = window.devicePixelRatio || 1 // todo this value is too high on ios, need to check, probably we should use avg, also need to make it configurable
    if (!this.renderer.capabilities.isWebGL2) {
      pixelRatio = 1 // webgl1 has issues with high pixel ratio (sometimes screen is clipped)
    }
    this.renderer.setPixelRatio(pixelRatio)
  }

  updateSize () {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  private addToPage () {
    this.canvas.id = 'viewer-canvas'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    document.body.appendChild(this.canvas)
  }

  private setupFpsTracking () {
    let max = 0
    this.fpsInterval = setInterval(() => {
      if (max > 0) {
        this.droppedFpsPercentage = this.renderedFps / max
      }
      max = Math.max(this.renderedFps, max)
      this.renderedFps = 0
    }, 1000)
  }

  // private handleResize () {
  //   const width = window.innerWidth
  //   const height = window.innerHeight

  //   viewer.camera.aspect = width / height
  //   viewer.camera.updateProjectionMatrix()
  //   this.renderer.setSize(width, height)
  //   viewer.world.handleResize()
  // }

  private startRenderLoop () {
    const animate = () => {
      if (this.disconnected) return
      this.animationFrameId = requestAnimationFrame(animate)

      if (this.paused) return

      // Handle FPS limiting
      if (this.config.fpsLimit) {
        const now = performance.now()
        const elapsed = now - this.lastRenderTime
        const fpsInterval = 1000 / this.config.fpsLimit

        if (elapsed < fpsInterval) {
          return
        }

        this.lastRenderTime = now - (elapsed % fpsInterval)
      }

      let sizeChanged = false
      if (this.previousWindowWidth !== window.innerWidth || this.previousWindowHeight !== window.innerHeight) {
        this.previousWindowWidth = window.innerWidth
        this.previousWindowHeight = window.innerHeight
        this.updateSize()
        sizeChanged = true
      }

      this.preRender()
      this.stats.markStart()
      tween.update()
      this.render(sizeChanged)
      for (const fn of this.onRender) {
        fn(sizeChanged)
      }
      this.renderedFps++
      this.stats.markEnd()
      this.postRender()

      // Update stats visibility each frame
      if (this.config.statsVisible !== undefined) {
        this.stats.setVisibility(this.config.statsVisible)
      }
    }

    animate()
  }

  setPaused (paused: boolean) {
    this.paused = paused
  }

  dispose () {
    this.disconnected = true
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }
    this.canvas.remove()
    this.renderer.dispose()
    clearInterval(this.fpsInterval)
    this.stats.dispose()
  }
}

class TopRightStats {
  private readonly stats: Stats
  private readonly stats2: Stats
  private readonly statsGl: StatsGl
  private total = 0
  private readonly denseMode: boolean

  constructor (private readonly canvas: HTMLCanvasElement, initialStatsVisible = 0) {
    this.stats = new Stats()
    this.stats2 = new Stats()
    this.statsGl = new StatsGl({ minimal: true })
    this.stats2.showPanel(2)
    this.denseMode = process.env.NODE_ENV === 'production' || window.innerHeight < 500

    this.initStats()
    this.setVisibility(initialStatsVisible)
  }

  private addStat (dom: HTMLElement, size = 80) {
    dom.style.position = 'absolute'
    if (this.denseMode) dom.style.height = '12px'
    dom.style.overflow = 'hidden'
    dom.style.left = ''
    dom.style.top = '0'
    dom.style.right = `${this.total}px`
    dom.style.width = '80px'
    dom.style.zIndex = '1'
    dom.style.opacity = '0.8'
    document.body.appendChild(dom)
    this.total += size
  }

  private initStats () {
    const hasRamPanel = this.stats2.dom.children.length === 3

    this.addStat(this.stats.dom)
    if (hasRamPanel) {
      this.addStat(this.stats2.dom)
    }

    this.statsGl.init(this.canvas)
    this.statsGl.container.style.display = 'flex'
    this.statsGl.container.style.justifyContent = 'flex-end'

    let i = 0
    for (const _child of this.statsGl.container.children) {
      const child = _child as HTMLElement
      if (i++ === 0) {
        child.style.display = 'none'
      }
      child.style.position = ''
    }
  }

  setVisibility (level: number) {
    const visible = level > 0
    if (visible) {
      this.stats.dom.style.display = 'block'
      this.stats2.dom.style.display = level >= 2 ? 'block' : 'none'
      this.statsGl.container.style.display = level >= 2 ? 'block' : 'none'
    } else {
      this.stats.dom.style.display = 'none'
      this.stats2.dom.style.display = 'none'
      this.statsGl.container.style.display = 'none'
    }
  }

  markStart () {
    this.stats.begin()
    this.stats2.begin()
    this.statsGl.begin()
  }

  markEnd () {
    this.stats.end()
    this.stats2.end()
    this.statsGl.end()
  }

  dispose () {
    this.stats.dom.remove()
    this.stats2.dom.remove()
    this.statsGl.container.remove()
  }
}
