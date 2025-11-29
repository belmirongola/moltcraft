import React, { type ReactElement, type ReactNode, useRef, useEffect, useState } from 'react'
import { createFrame, createFrameNeroSettings } from '@arwes/frames'
import { createAnimatorSystem } from '@arwes/animator'
import {
  Animated,
  type AnimatedProp,
  Animator,
  FrameCorners,
  useBleeps,
  useFrameAssembler,
  createThemeMultiplier
} from '@arwes/react'

export const BUTTON_COLOR_PALETTES = {
  default: {
    // Main cyan color used for border/frame to match reference (#4bf2f6)
    text: '#a9fdff',
    // text: 'white',
    textHover: '#aefbff',
    line: '#4bf2f6',
    lineHover: '#aefbff',
    // Background fill colors (matching mainMenu MenuButton behavior)
    bg: 'rgba(6, 43, 45, 0.4)',
    // Hover background: much brighter cyan glow
    bgHover: 'rgb(75, 239, 239, 0.5)',
    bgOpacity: 0.4,
    bgHoverOpacity: 1
  }
} as const

const FRAME_DEFAULT_COLORS = {
  bg: 'hsl(180, 75%, 10%)',
  line: 'hsl(180, 75%, 30%)',
  deco: 'hsl(180, 75%, 50%)'
}

interface FrameNeroProps {
  width?: number
  height?: number
  style?: React.CSSProperties
  settings?: Parameters<typeof createFrameNeroSettings>[0]
  active?: boolean
  duration?: { enter?: number; exit?: number }
}

export const FrameNero: React.FC<FrameNeroProps> = ({
  width = 300,
  height = 200,
  style,
  settings = {},
  active: controlledActive,
  duration = { enter: 1, exit: 0.5 }
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const animatorRef = useRef<{ send: (action: 'setup' | 'update') => void } | null>(null)
  const activeRef = useRef(false)
  const durationRef = useRef(duration)
  const active = controlledActive ?? true

  // Keep refs in sync with current values
  activeRef.current = active
  durationRef.current = duration

  // Initialize frame and animator once
  useEffect(() => {
    if (!svgRef.current || animatorRef.current) return

    const system = createAnimatorSystem()
    const animator = system.register(undefined, {
      getSettings: () => ({ active: activeRef.current, duration: durationRef.current })
    })
    animatorRef.current = animator

    createFrame(svgRef.current, {
      animator,
      ...createFrameNeroSettings(settings)
    })

    animator.send('setup')
  }, [settings])

  // Update animator when active changes
  useEffect(() => {
    if (animatorRef.current) {
      animatorRef.current.send('update')
    }
  }, [active])
  const mergedStyle: React.CSSProperties = {
    '--arwes-frames-bg-color': FRAME_DEFAULT_COLORS.bg,
    '--arwes-frames-line-color': FRAME_DEFAULT_COLORS.line,
    '--arwes-frames-deco-color': FRAME_DEFAULT_COLORS.deco,
    ...style
  } as React.CSSProperties

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      style={mergedStyle}
    />
  )
}

interface FrameNeroContainerProps {
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

export const FrameNeroContainer: React.FC<FrameNeroContainerProps> = ({
  children,
  style,
  className
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        ...style
      } as React.CSSProperties}
      className={className}
    >
      {children}
    </div>
  )
}

// Button wrapper component that uses FrameCorners (like MenuButton from mainMenu)
interface ButtonWithFrameProps {
  // Size-related props from Button
  label?: string
  icon?: string
  inScreen?: boolean
  style?: React.CSSProperties
  // Animation props
  animated?: AnimatedProp
  // Color palette variant
  colorPalette?: keyof typeof BUTTON_COLOR_PALETTES
  // Delay for animation (useful when used in main menu)
  animationDelay?: number
  // Children is the already rendered button
  children: React.ReactNode
  // Event handlers
  onMouseEnter?: () => void
  onClick?: () => void
}

const theme = {
  spacen: createThemeMultiplier(index => index * 4)
}

// Separate component for the frame that can be mounted with delay
interface ButtonFrameProps {
  frameRef: React.RefObject<SVGSVGElement>
  cornerLength: number
  className: string
}

const ButtonFrame: React.FC<ButtonFrameProps> = ({ frameRef, cornerLength, className }) => {
  useFrameAssembler(frameRef)
  return <FrameCorners elementRef={frameRef} animated cornerLength={cornerLength} className={className} />
}

// Add styles for all palettes on module init
const addAllButtonStyles = (): void => {
  const styleElement = document.createElement('style')
  styleElement.id = 'arwes-button-with-frame-styles'

  // Remove existing styles if present
  const existing = document.getElementById('arwes-button-with-frame-styles')
  if (existing) {
    existing.remove()
  }

  let styles = ''

  // Generate styles for each palette
  for (const [paletteName, palette] of Object.entries(BUTTON_COLOR_PALETTES)) {
    styles += `
      .arwes-button-with-frame[data-palette="${paletteName}"] {
        position: relative;
        outline: none;
        border: 1px solid ${palette.line};
        /* padding: 0.25rem 1.75rem; */
        /* line-height: 2rem; */
        font-size: 0.75rem;
        font-family: inherit;
        letter-spacing: 0.2rem;
        text-transform: uppercase;
        color: ${palette.text} !important;
        background: ${palette.bg};
        cursor: pointer;
        transition: color 0.2s ease-out, transform 0.2s ease-out, background 0.2s ease-out, border-color 0.2s ease-out;
      }
      .arwes-button-with-frame[data-palette="${paletteName}"] .arwes-button-with-frame-frame {
        position: absolute;
        top: -1.5px !important;
        left: -1.5px !important;
        width: calc(100% + 3px) !important;
        height: calc(100% + 3px) !important;
        pointer-events: none;
      }
      .arwes-button-with-frame[data-palette="${paletteName}"] .arwes-frames-framesvg {
        width: 100%;
        height: 100%;
        transition: transform 0.2s ease-out;
      }
      .arwes-button-with-frame[data-palette="${paletteName}"] .arwes-button-with-frame-content {
        position: relative;
        z-index: 1;
      }
      .arwes-button-with-frame[data-palette="${paletteName}"] [data-name=line] {
        color: ${palette.line};
        transition: color 0.2s ease-out;
      }
      .arwes-button-with-frame[data-palette="${paletteName}"] [data-name=bg] {
        color: transparent;
        opacity: 0;
      }
      .arwes-button-with-frame[data-palette="${paletteName}"]:hover,
      .arwes-button-with-frame[data-palette="${paletteName}"]:focus-visible {
        color: ${palette.textHover};
        border-color: ${palette.lineHover};
        background: ${palette.bgHover};
        transform: translateY(-2px);
      }
      .arwes-button-with-frame[data-palette="${paletteName}"]:hover [data-name=line],
      .arwes-button-with-frame[data-palette="${paletteName}"]:focus-visible [data-name=line] {
        color: ${palette.lineHover};
      }
    `
  }

  styleElement.innerHTML = styles
  document.body.appendChild(styleElement)
}

// Initialize styles on module load
if (typeof document !== 'undefined') {
  addAllButtonStyles()
}

export const ButtonWithFrame: React.FC<ButtonWithFrameProps> = ({
  animated,
  colorPalette = 'default',
  animationDelay,
  onMouseEnter,
  onClick,
  children
}) => {
  const frameRef = useRef<SVGSVGElement>(null)
  const [showFrame, setShowFrame] = useState(false)

  // Delay frame mounting based on animationDelay
  useEffect(() => {
    if (animationDelay === undefined) {
      setShowFrame(true)
    } else {
      const timer = setTimeout(() => {
        setShowFrame(true)
      }, animationDelay)
      return () => clearTimeout(timer)
    }
  }, [animationDelay])

  // Build animation prop with optional delay
  const animationProp: AnimatedProp = animated ?? (animationDelay === undefined
    ? ['flicker']
    : ['flicker', { transitions: { entering: { delay: animationDelay } } }])

  return (
    <Animated
      as="button"
      className="arwes-button-with-frame"
      data-palette={colorPalette}
      animated={animationProp}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      {/* Frame mounted with delay, sits outside the button content */}
      {showFrame && (
        <ButtonFrame
          frameRef={frameRef}
          cornerLength={theme.spacen(3)}
          className="arwes-button-with-frame-frame"
        />
      )}
      <span className="arwes-button-with-frame-content">
        {children}
      </span>
    </Animated>
  )
}

// Example usage component
// export const FrameNeroSandbox = (): ReactElement => {
//   return (
//     <FrameNeroContainer>
//       <div style={{ position: 'relative', width: 300, height: 200 }}>
//         <FrameNero
//           width={300}
//           height={200}
//           style={{
//             // @ts-expect-error css variables
//             '--arwes-frames-bg-color': 'hsl(180, 75%, 10%)',
//             '--arwes-frames-line-color': 'hsl(180, 75%, 30%)',
//             '--arwes-frames-deco-color': 'hsl(180, 75%, 50%)'
//           }}
//         />
//       </div>
//       <div style={{ position: 'relative', width: 300, height: 200 }}>
//         <FrameNero
//           width={300}
//           height={200}
//           settings={{
//             padding: 10,
//             cornerLength: 40,
//             cornerWidth: 4
//           }}
//         />
//       </div>
//     </FrameNeroContainer>
//   )
// }

window.mcraft.ui.registerReactWrapper('button', 'arwes', ButtonWithFrame)
