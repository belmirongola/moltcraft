import * as THREE from 'three'
import { WorldRendererThree } from '../worldrendererThree'

export class VRHud {
  private hudMesh: THREE.Mesh
  private hudCanvas: HTMLCanvasElement
  private hudContext: CanvasRenderingContext2D
  private hudTexture: THREE.CanvasTexture
  private hudGroup: THREE.Group
  
  constructor(private worldRenderer: WorldRendererThree) {
    // Create canvas for HUD
    this.hudCanvas = document.createElement('canvas')
    this.hudCanvas.width = 1024
    this.hudCanvas.height = 512
    
    this.hudContext = this.hudCanvas.getContext('2d')!
    
    // Create texture from canvas
    this.hudTexture = new THREE.CanvasTexture(this.hudCanvas)
    this.hudTexture.minFilter = THREE.LinearFilter
    this.hudTexture.magFilter = THREE.LinearFilter
    
    // Create HUD geometry - a plane that will display our canvas
    // Adjusted size for better VR viewing
    const hudGeometry = new THREE.PlaneGeometry(3, 1.5)
    const hudMaterial = new THREE.MeshBasicMaterial({
      map: this.hudTexture,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    })
    
    this.hudMesh = new THREE.Mesh(hudGeometry, hudMaterial)
    this.hudMesh.renderOrder = 1000 // Render on top
    
    // Create a group to hold the HUD
    this.hudGroup = new THREE.Group()
    this.hudGroup.add(this.hudMesh)
    
    // Position the HUD in front of the camera
    // Slightly lower and further for comfortable VR viewing
    this.hudMesh.position.set(0, -0.3, -2.5)
    
    // Initial render to show something
    this.update()
  }
  
  attachToVRCamera(vrCameraGroup: THREE.Object3D) {
    // Add HUD to the VR camera group so it follows the player's view
    vrCameraGroup.add(this.hudGroup)
  }
  
  detachFromVRCamera(vrCameraGroup: THREE.Object3D) {
    vrCameraGroup.remove(this.hudGroup)
  }
  
  update() {
    // Get player data
    const bot = (window as any).bot
    const playerState = this.worldRenderer.playerState
    
    // Clear canvas
    this.hudContext.clearRect(0, 0, this.hudCanvas.width, this.hudCanvas.height)
    
    // Set up text styling
    this.hudContext.fillStyle = 'white'
    this.hudContext.strokeStyle = 'black'
    this.hudContext.lineWidth = 3
    this.hudContext.font = 'bold 32px Arial'
    this.hudContext.textAlign = 'left'
    this.hudContext.textBaseline = 'top'
    
    // Top left - FPS and Ping
    const fps = Math.round(1000 / this.worldRenderer.renderTimeAvg) || 0
    const ping = bot?._client?.latency || 0
    
    this.drawText(`FPS: ${fps}`, 50, 50)
    this.drawText(`Ping: ${ping}ms`, 50, 90)
    
    // Top right - Velocity and Coords
    this.hudContext.textAlign = 'right'
    const velocity = playerState.getVelocity()
    const position = playerState.getPosition()
    const vel = Math.sqrt(velocity.x ** 2 + velocity.z ** 2).toFixed(2)
    
    this.drawText(`Vel: ${vel} m/s`, this.hudCanvas.width - 50, 50)
    this.drawText(`X: ${position.x.toFixed(1)}`, this.hudCanvas.width - 50, 90)
    this.drawText(`Y: ${position.y.toFixed(1)}`, this.hudCanvas.width - 50, 130)
    this.drawText(`Z: ${position.z.toFixed(1)}`, this.hudCanvas.width - 50, 170)
    
    // Bottom left - Health
    this.hudContext.textAlign = 'left'
    this.hudContext.textBaseline = 'bottom'
    const health = bot?.health || 10
    const maxHealth = 20
    const hearts = health / 2
    const maxHearts = maxHealth / 2
    
    this.drawText(`HP: ${hearts}/${maxHearts} ❤`, 50, this.hudCanvas.height - 50)
    
    // Bottom right - Game mode
    this.hudContext.textAlign = 'right'
    const gameMode = playerState.reactive.gameMode || 'survival'
    this.drawText(`Mode: ${gameMode}`, this.hudCanvas.width - 50, this.hudCanvas.height - 50)
    
    // Update texture
    this.hudTexture.needsUpdate = true
  }
  
  private drawText(text: string, x: number, y: number) {
    // Draw text with outline for better visibility
    this.hudContext.strokeText(text, x, y)
    this.hudContext.fillText(text, x, y)
  }
  
  setVisible(visible: boolean) {
    this.hudMesh.visible = visible
  }
  
  dispose() {
    this.hudTexture.dispose()
    this.hudMesh.geometry.dispose()
    ;(this.hudMesh.material as THREE.Material).dispose()
    this.hudCanvas.remove()
  }
}