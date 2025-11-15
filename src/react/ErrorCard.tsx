import { ReactNode, useEffect, useRef } from 'react'
import { useIsModalActive } from './utilsApp'
import './ErrorCard.css'

interface Props {
  message: string
  lastPacket?: string
  description?: ReactNode
  ip?: string
  version?: string
  proxyUrl?: string
  actions?: ReactNode
}

export const ErrorCard = ({ message, lastPacket, description, ip, version, proxyUrl, actions }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.scale(dpr, dpr)

      // Clear canvas
      ctx.clearRect(0, 0, rect.width, rect.height)

      // Block settings
      const blockSize = 12 // Size of each block
      const gap = 2 // Gap between blocks
      const blockColor = '#993333' // Darker version of description color (#ffaaaa)
      const numBlocks = Math.ceil(rect.width / (blockSize + gap))

      // Draw blocks with random heights
      for (let i = 0; i < numBlocks; i++) {
        const x = i * (blockSize + gap)
        const height = Math.floor(Math.random() * 4) + 1 // Random height 1-4

        for (let h = 0; h < height; h++) {
          const y = rect.height - (h + 1) * (blockSize + gap)
          ctx.fillStyle = blockColor
          ctx.fillRect(x, y, blockSize, blockSize)
        }
      }
    }

    updateCanvas()

    // Re-draw on resize
    const resizeObserver = new ResizeObserver(updateCanvas)
    resizeObserver.observe(canvas)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div className="error-card-container">
      <div className="error-card">
        <div className="error-card-header">
          {ip && <div className="error-card-info-item">IP: {ip}</div>}
          {version && <div className="error-card-info-item">Version: {version}</div>}
          {proxyUrl && <div className="error-card-info-item">Proxy: {proxyUrl}</div>}
        </div>

        <div className="error-card-content">
          <div className="error-card-message">{message}</div>
          {lastPacket && (
            <div className="error-card-last-packet">
              Last Packet: {lastPacket}
            </div>
          )}
          {description && (
            <div className="error-card-description">{description}</div>
          )}
        </div>

        <canvas ref={canvasRef} className="error-card-terrain" />

        {actions && <div className="error-card-actions-mobile">{actions}</div>}
      </div>

      {actions && <div className="error-card-actions-desktop">{actions}</div>}
    </div>
  )
}

export const ErrorCardTester = () => {
  const isModalActive = useIsModalActive('error-test')

  if (!isModalActive) return null

  return (
    <ErrorCard
      message="Connection failed: Connection timeout"
      lastPacket="login_success"
      description="The server took too long to respond. Please check your connection and try again."
      ip="128.0.135.154:25570"
      version="1.20.4"
      proxyUrl="proxy.mcraft.fun:443"
      actions={
        <>
          <button>Reconnect</button>
          <button>Back to Menu</button>
        </>
      }
    />
  )
}
