import React from 'react'
import ReactDOM from 'react-dom'
import { motion } from 'framer-motion'

interface SciFiLoaderProps {
  message?: string;
  connected?: boolean;
  className?: string;
}

const containerVariants = {
  hidden: {
    scale: 0.8,
    opacity: 0
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: 'easeOut',
      staggerChildren: 0.08
    }
  },
  exit: {
    scale: 2.5,
    opacity: 0,
    transition: {
      duration: 0.8,
      ease: [0.4, 0, 0.2, 1],
      staggerChildren: 0.05,
      staggerDirection: 1
    }
  }
}

const childVariants = {
  hidden: {
    scale: 0,
    opacity: 0
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
      duration: 0.5
    }
  },
  exit: {
    scale: 1.5,
    opacity: 0,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1]
    }
  }
}

const SciFiLoader: React.FC<SciFiLoaderProps> = ({
  message = 'CONNECTING TO SERVER...',
  connected = false,
  className
}) => {
  // Rotating circles configuration - using percentages for responsive sizing
  const circles = [
    { width: 440, height: 440, duration: 35, dashArray: '12 5' },
    { width: 380, height: 380, duration: 30, dashArray: '10 5' },
    { width: 320, height: 320, duration: 25, dashArray: '15 3' },
    { width: 260, height: 260, duration: 20, dashArray: '8 4' },
    { width: 200, height: 200, duration: 15, dashArray: '5 3' },
    { width: 140, height: 140, duration: 10, dashArray: '4 2' }
  ]

  // Tick marks for the outer circle
  const tickMarks = Array.from({ length: 72 }, (_, i) => i) // More ticks for detail

  return (
    <motion.div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(5, 20, 40, 0.95)',
        overflow: 'hidden'
      }}
      className={className}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '520px',
          height: '520px'
        }}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Rotating circles */}
        {circles.map((circle, index) => (
          <motion.div
            key={index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              margin: 'auto',
              width: `${circle.width}px`,
              height: `${circle.height}px`,
              borderRadius: '50%',
              border: '1px dashed',
              borderColor: 'rgba(34, 211, 238, 0.3)',
              borderStyle: 'dashed',
              borderWidth: '1px',
              WebkitMaskImage: `repeating-linear-gradient(0deg, transparent, transparent ${circle.dashArray.split(' ')[1]}px, black ${circle.dashArray.split(' ')[1]}px ${circle.dashArray.split(' ')[0]}px)`
            }}
            variants={childVariants}
            animate={{
              rotate: 360
            }}
            transition={{
              duration: circle.duration,
              ease: 'linear',
              repeat: Infinity
            }}
          />
        ))}

        {/* Outer static circle with tick marks */}
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            margin: 'auto',
            width: '480px',
            height: '480px'
          }}
          variants={childVariants}
        >
          {tickMarks.map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: '4px',
                height: '12px',
                backgroundColor: 'rgba(34, 211, 238, 0.3)',
                transform: `rotate(${i * 5}deg) translateX(-50%) translateY(-240px)`,
                transformOrigin: 'center'
              }}
            />
          ))}
        </motion.div>

        {/* Arc segments */}
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            margin: 'auto',
            width: '500px',
            height: '500px'
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 40,
            ease: 'linear',
            repeat: Infinity
          }}
          variants={childVariants}
        >
          {[0, 90, 180, 270].map((rotation) => (
            <div
              key={rotation}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                transform: `rotate(${rotation}deg)`
              }}
            >
              <motion.div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  width: '4px',
                  height: '32px',
                  transform: 'translateX(-50%)',
                  transformOrigin: 'bottom',
                  borderRadius: '9999px'
                }}
                animate={{
                  backgroundColor: connected
                    ? 'rgba(50, 255, 50, 0.6)'
                    : 'rgba(34, 211, 238, 0.5)'
                }}
                transition={{
                  duration: 0.8,
                  ease: 'easeInOut'
                }}
              />
            </div>
          ))}
        </motion.div>

        {/* Center spinner */}
        <motion.div
          style={{
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          variants={childVariants}
        >
          <motion.div
            style={{
              width: '64px',
              height: '64px'
            }}
            animate={{ rotate: -360 }}
            transition={{
              duration: 2,
              ease: 'linear',
              repeat: Infinity
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                border: '4px solid',
                borderTopColor: 'rgb(34, 211, 238)',
                borderRightColor: 'rgba(34, 211, 238, 0.5)',
                borderBottomColor: 'rgba(34, 211, 238, 0.3)',
                borderLeftColor: 'rgba(34, 211, 238, 0.1)',
                borderRadius: '50%'
              }}
            />
          </motion.div>
          <p style={{
            color: 'rgb(34, 211, 238)',
            fontSize: '14px',
            fontFamily: 'monospace',
            marginTop: 20,
            letterSpacing: '0.1em'
          }}>
            {message}
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

interface SciFiLoaderWrapperProps {
  children: React.ReactNode
  status: string
  isError: boolean
}

const LoaderWrapper = ({ children, status, isError }: SciFiLoaderWrapperProps) => {
  const { hadConnected } = window.mcraft.valtio.useSnapshot(window.miscUiState)

  if (isError) return children

  return <>
    {/* <ScreenBackdrop /> */}
    {ReactDOM.createPortal(
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
        }}
      >
        <SciFiLoader connected={hadConnected} message={status} />
      </div>,
      document.body
    )}
  </>
}

window.mcraft.ui.registerReactWrapper('appStatus', 'arwes', LoaderWrapper)
