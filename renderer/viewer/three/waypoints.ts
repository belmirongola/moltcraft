import * as THREE from 'three'
import { WorldRendererThree } from './worldrendererThree'
import { createWaypointSprite, type WaypointSprite } from './waypointSprite'

interface Waypoint {
  id: string
  x: number
  y: number
  z: number
  minDistance: number
  color: number
  label?: string
  sprite: WaypointSprite
}

interface WaypointOptions {
  color?: number
  label?: string
  minDistance?: number
  metadata?: any
}

export class WaypointsRenderer {
  private readonly waypoints = new Map<string, Waypoint>()
  private readonly waypointScene = new THREE.Scene()

  constructor (
    private readonly worldRenderer: WorldRendererThree
  ) {
  }

  private updateWaypoints () {
    const playerPos = this.worldRenderer.cameraObject.position
    const sizeVec = this.worldRenderer.renderer.getSize(new THREE.Vector2())

    for (const waypoint of this.waypoints.values()) {
      const waypointPos = new THREE.Vector3(waypoint.x, waypoint.y, waypoint.z)
      const distance = playerPos.distanceTo(waypointPos)
      const visible = !waypoint.minDistance || distance >= waypoint.minDistance

      waypoint.sprite.setVisible(visible)

      if (visible) {
        // Update position
        waypoint.sprite.setPosition(waypoint.x, waypoint.y, waypoint.z)
        // Ensure camera-based update each frame
        waypoint.sprite.updateForCamera(this.worldRenderer.getCameraPosition(), this.worldRenderer.camera, sizeVec.width, sizeVec.height)
      }
    }
  }

  render () {
    if (this.waypoints.size === 0) return

    // Update waypoint scaling
    this.updateWaypoints()

    // Render waypoints scene with the world camera
    this.worldRenderer.renderer.render(this.waypointScene, this.worldRenderer.camera)
  }

  // Removed sprite/label texture creation. Use utils/waypointSprite.ts

  addWaypoint (
    id: string,
    x: number,
    y: number,
    z: number,
    options: WaypointOptions = {}
  ) {
    // Remove existing waypoint if it exists
    this.removeWaypoint(id)

    const color = options.color ?? 0xFF_00_00
    const { label, metadata } = options
    const minDistance = options.minDistance ?? 0

    const sprite = createWaypointSprite({
      position: new THREE.Vector3(x, y, z),
      color,
      label: (label || id),
      metadata,
    })
    sprite.enableOffscreenArrow(true)
    sprite.setArrowParent(this.waypointScene)

    this.waypointScene.add(sprite.group)

    this.waypoints.set(id, {
      id, x: x + 0.5, y: y + 0.5, z: z + 0.5, minDistance,
      color, label,
      sprite,
    })
  }

  removeWaypoint (id: string) {
    const waypoint = this.waypoints.get(id)
    if (waypoint) {
      this.waypointScene.remove(waypoint.sprite.group)
      waypoint.sprite.dispose()
      this.waypoints.delete(id)
    }
  }

  clear () {
    for (const id of this.waypoints.keys()) {
      this.removeWaypoint(id)
    }
  }

  testWaypoint () {
    this.addWaypoint('Test Point', 0, 70, 0, { color: 0x00_FF_00, label: 'Test Point' })
    this.addWaypoint('Spawn', 0, 64, 0, { color: 0xFF_FF_00, label: 'Spawn' })
    this.addWaypoint('Far Point', 100, 70, 100, { color: 0x00_00_FF, label: 'Far Point' })
  }

  getWaypoint (id: string): Waypoint | undefined {
    return this.waypoints.get(id)
  }

  getAllWaypoints (): Waypoint[] {
    return [...this.waypoints.values()]
  }

  setWaypointColor (id: string, color: number) {
    const waypoint = this.waypoints.get(id)
    if (waypoint) {
      waypoint.sprite.setColor(color)
      waypoint.color = color
    }
  }

  setWaypointLabel (id: string, label?: string) {
    const waypoint = this.waypoints.get(id)
    if (waypoint) {
      waypoint.label = label
      waypoint.sprite.setLabel(label)
    }
  }
}
