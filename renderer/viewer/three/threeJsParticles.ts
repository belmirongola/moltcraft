import * as THREE from 'three'

interface ParticleMesh extends THREE.Mesh {
  velocity: THREE.Vector3;
}

interface ParticleConfig {
  fountainHeight: number;
  resetHeight: number;
  xVelocityRange: number;
  zVelocityRange: number;
  particleCount: number;
  particleRadiusRange: { min: number; max: number };
  yVelocityRange: { min: number; max: number };
}

export interface FountainOptions {
  position?: { x: number, y: number, z: number }
  particleConfig?: Partial<ParticleConfig>;
}

export class Fountain {
  private readonly particles: ParticleMesh[] = []
  private readonly config: { particleConfig: ParticleConfig }
  private readonly position: THREE.Vector3
  container: THREE.Object3D | undefined

  constructor (public sectionId: string, options: FountainOptions = {}) {
    this.position = options.position ? new THREE.Vector3(options.position.x, options.position.y, options.position.z) : new THREE.Vector3(0, 0, 0)
    this.config = this.createConfig(options.particleConfig)
  }

  private createConfig (
    particleConfigOverride?: Partial<ParticleConfig>
  ): { particleConfig: ParticleConfig } {
    const particleConfig: ParticleConfig = {
      fountainHeight: 10,
      resetHeight: 0,
      xVelocityRange: 0.4,
      zVelocityRange: 0.4,
      particleCount: 400,
      particleRadiusRange: { min: 0.1, max: 0.6 },
      yVelocityRange: { min: 0.1, max: 2 },
      ...particleConfigOverride
    }

    return { particleConfig }
  }


  createParticles (container: THREE.Object3D): void {
    this.container = container
    const colorStart = new THREE.Color(0xff_ff_00)
    const colorEnd = new THREE.Color(0xff_a5_00)

    for (let i = 0; i < this.config.particleConfig.particleCount; i++) {
      const radius = Math.random() *
        (this.config.particleConfig.particleRadiusRange.max - this.config.particleConfig.particleRadiusRange.min) +
        this.config.particleConfig.particleRadiusRange.min
      const geometry = new THREE.SphereGeometry(radius)
      const material = new THREE.MeshBasicMaterial({
        color: colorStart.clone().lerp(colorEnd, Math.random())
      })
      const mesh = new THREE.Mesh(geometry, material)
      const particle = mesh as unknown as ParticleMesh

      particle.position.set(
        this.position.x + (Math.random() - 0.5) * this.config.particleConfig.xVelocityRange * 2,
        this.position.y + this.config.particleConfig.fountainHeight,
        this.position.z + (Math.random() - 0.5) * this.config.particleConfig.zVelocityRange * 2
      )

      particle.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * this.config.particleConfig.xVelocityRange,
        -Math.random() * this.config.particleConfig.yVelocityRange.max,
        (Math.random() - 0.5) * this.config.particleConfig.zVelocityRange
      )

      this.particles.push(particle)
      this.container.add(particle)

      // this.container.onBeforeRender = () => {
      //   this.render()
      // }
    }
  }

  render (): void {
    for (const particle of this.particles) {
      particle.velocity.y -= 0.01 + Math.random() * 0.1
      particle.position.add(particle.velocity)

      if (particle.position.y < this.position.y + this.config.particleConfig.resetHeight) {
        particle.position.set(
          this.position.x + (Math.random() - 0.5) * this.config.particleConfig.xVelocityRange * 2,
          this.position.y + this.config.particleConfig.fountainHeight,
          this.position.z + (Math.random() - 0.5) * this.config.particleConfig.zVelocityRange * 2
        )
        particle.velocity.set(
          (Math.random() - 0.5) * this.config.particleConfig.xVelocityRange,
          -Math.random() * this.config.particleConfig.yVelocityRange.max,
          (Math.random() - 0.5) * this.config.particleConfig.zVelocityRange
        )
      }
    }
  }

  private updateParticleCount (newCount: number): void {
    if (newCount !== this.config.particleConfig.particleCount) {
      this.config.particleConfig.particleCount = newCount
      const currentCount = this.particles.length

      if (newCount > currentCount) {
        this.addParticles(newCount - currentCount)
      } else if (newCount < currentCount) {
        this.removeParticles(currentCount - newCount)
      }
    }
  }

  private addParticles (count: number): void {
    const geometry = new THREE.SphereGeometry(0.1)
    const material = new THREE.MeshBasicMaterial({ color: 0x00_ff_00 })

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geometry, material)
      const particle = mesh as unknown as ParticleMesh
      particle.position.copy(this.position)
      particle.velocity = new THREE.Vector3(
        Math.random() * this.config.particleConfig.xVelocityRange -
        this.config.particleConfig.xVelocityRange / 2,
        Math.random() * 2,
        Math.random() * this.config.particleConfig.zVelocityRange -
        this.config.particleConfig.zVelocityRange / 2
      )
      this.particles.push(particle)
      this.container!.add(particle)
    }
  }

  private removeParticles (count: number): void {
    for (let i = 0; i < count; i++) {
      const particle = this.particles.pop()
      if (particle) {
        this.container!.remove(particle)
      }
    }
  }

  public dispose (): void {
    for (const particle of this.particles) {
      particle.geometry.dispose()
      if (Array.isArray(particle.material)) {
        for (const material of particle.material) material.dispose()
      } else {
        particle.material.dispose()
      }
    }
  }
}

interface RainParticleData {
  velocity: THREE.Vector3;
  age: number;
}

export interface RainOptions {
  particleCount?: number;
  range?: number;
  height?: number;
  fallSpeed?: { min: number; max: number };
}

export class RainParticles {
  private readonly particleData: RainParticleData[] = []
  private readonly instancedMesh: THREE.InstancedMesh
  private readonly dummy = new THREE.Object3D()
  private cameraPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
  private particleCount: number
  private range: number
  private height: number
  private fallSpeed: { min: number; max: number }
  private enabled = false
  private readonly geometry: THREE.BoxGeometry
  private readonly material: THREE.MeshBasicMaterial

  constructor (scene: THREE.Scene, options: RainOptions = {}) {
    // Minecraft-like rain settings - more particles, smaller size
    this.particleCount = options.particleCount ?? 2000
    this.range = options.range ?? 32 // Horizontal range around player
    this.height = options.height ?? 32 // Height above camera
    this.fallSpeed = options.fallSpeed ?? { min: 0.2, max: 0.4 }

    // Create geometry and material (smaller boxes)
    this.geometry = new THREE.BoxGeometry(0.03, 0.3, 0.03)
    this.material = new THREE.MeshBasicMaterial({
      color: 0x44_66_99, // Darker blue to match Minecraft rain
      transparent: true,
      opacity: 0.6
    })

    // Create instanced mesh for better performance
    this.instancedMesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      this.particleCount
    )
    this.instancedMesh.name = 'rain-particles'
    this.instancedMesh.visible = false // Start hidden
    
    scene.add(this.instancedMesh)

    this.initializeParticles()
  }

  private initializeParticles (): void {
    for (let i = 0; i < this.particleCount; i++) {
      // Randomly position particles in a cylinder around the camera
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * this.range
      const x = Math.cos(angle) * distance
      const z = Math.sin(angle) * distance
      const y = Math.random() * this.height

      // Rain falls straight down with slight variation
      const speed = this.fallSpeed.min + Math.random() * (this.fallSpeed.max - this.fallSpeed.min)
      
      this.particleData.push({
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.02, // Slight horizontal drift
          -speed,
          (Math.random() - 0.5) * 0.02
        ),
        age: Math.random()
      })

      // Set initial position
      this.dummy.position.set(x, y, z)
      this.dummy.updateMatrix()
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix)
    }
    
    this.instancedMesh.instanceMatrix.needsUpdate = true
  }

  updateCameraPosition (position: THREE.Vector3): void {
    this.cameraPosition.copy(position)
    // Update instanced mesh position to follow camera
    this.instancedMesh.position.copy(position)
  }

  setEnabled (enabled: boolean): void {
    this.enabled = enabled
    this.instancedMesh.visible = enabled
  }

  isEnabled (): boolean {
    return this.enabled
  }

  render (): void {
    if (!this.enabled) return

    for (let i = 0; i < this.particleCount; i++) {
      const data = this.particleData[i]
      
      // Get current position
      this.instancedMesh.getMatrixAt(i, this.dummy.matrix)
      this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale)

      // Update particle position
      this.dummy.position.add(data.velocity)
      data.age += 0.016 // Approximate frame time

      // Check if particle has fallen below the ground or is too far
      const relativeY = this.dummy.position.y
      const relativeX = this.dummy.position.x
      const relativeZ = this.dummy.position.z
      const horizontalDistance = Math.sqrt(relativeX * relativeX + relativeZ * relativeZ)

      // Reset particle if it's too low or too far from center
      if (relativeY < -5 || horizontalDistance > this.range) {
        // Respawn at top within range
        const angle = Math.random() * Math.PI * 2
        const distance = Math.random() * this.range
        this.dummy.position.set(
          Math.cos(angle) * distance,
          this.height,
          Math.sin(angle) * distance
        )

        // Reset velocity
        const speed = this.fallSpeed.min + Math.random() * (this.fallSpeed.max - this.fallSpeed.min)
        data.velocity.set(
          (Math.random() - 0.5) * 0.02,
          -speed,
          (Math.random() - 0.5) * 0.02
        )

        data.age = 0
      }

      // Update matrix
      this.dummy.updateMatrix()
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix)
    }
    
    this.instancedMesh.instanceMatrix.needsUpdate = true
  }

  public dispose (): void {
    // Dispose geometry and material
    this.geometry.dispose()
    this.material.dispose()

    // Remove from scene
    if (this.instancedMesh.parent) {
      this.instancedMesh.parent.remove(this.instancedMesh)
    }

    // Clear particle data
    this.particleData.length = 0
  }
}
