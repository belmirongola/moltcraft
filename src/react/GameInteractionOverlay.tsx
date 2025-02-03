import { useRef } from 'react'
import { useSnapshot } from 'valtio'
import { useUtilsEffect } from '@zardoy/react-util'
import { options } from '../optionsStorage'
import { activeModalStack, isGameActive, miscUiState } from '../globalState'
import worldInteractions from '../worldInteractions'
import { onCameraMove, CameraMoveEvent } from '../cameraRotationControls'
import { handleMovementStickDelta, joystickPointer } from './TouchAreasControls'

/** after what time of holding the finger start breaking the block */
const touchStartBreakingBlockMs = 500

function GameInteractionOverlayInner ({ zIndex }: { zIndex: number }) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useUtilsEffect(({ signal }) => {
    if (!overlayRef.current) return

    const cameraControlEl = overlayRef.current
    let virtualClickActive = false
    let virtualClickTimeout: NodeJS.Timeout | undefined
    let screenTouches = 0
    let capturedPointer: {
      id: number;
      x: number;
      y: number;
      sourceX: number;
      sourceY: number;
      activateCameraMove: boolean;
      time: number
    } | undefined

    const pointerDownHandler = (e: PointerEvent) => {
      const clickedEl = e.composedPath()[0]
      if (!isGameActive(true) || clickedEl !== cameraControlEl || e.pointerId === undefined) {
        return
      }
      screenTouches++
      if (screenTouches === 3) {
        // todo maybe mouse wheel click?
      }
      const usingModernMovement = options.touchMovementType === 'modern'
      if (usingModernMovement) {
        if (!joystickPointer.pointer && e.clientX < window.innerWidth / 2) {
          cameraControlEl.setPointerCapture(e.pointerId)
          joystickPointer.pointer = {
            pointerId: e.pointerId,
            x: e.clientX,
            y: e.clientY
          }
          return
        }
      }
      if (capturedPointer) {
        return
      }
      cameraControlEl.setPointerCapture(e.pointerId)
      capturedPointer = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        sourceX: e.clientX,
        sourceY: e.clientY,
        activateCameraMove: false,
        time: Date.now()
      }
      if (options.touchInteractionType === 'classic') {
        virtualClickTimeout ??= setTimeout(() => {
          virtualClickActive = true
          document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
        }, touchStartBreakingBlockMs)
      }
    }

    const pointerMoveHandler = (e: PointerEvent) => {
      if (e.pointerId === undefined) return
      const supportsPressure = (e as any).pressure !== undefined &&
        (e as any).pressure !== 0 &&
        (e as any).pressure !== 0.5 &&
        (e as any).pressure !== 1 &&
        (e.pointerType === 'touch' || e.pointerType === 'pen')

      if (e.pointerId === joystickPointer.pointer?.pointerId) {
        handleMovementStickDelta(e)
        if (supportsPressure && (e as any).pressure > 0.5) {
          bot.setControlState('sprint', true)
        }
        return
      }
      if (e.pointerId !== capturedPointer?.id) return
      // window.scrollTo(0, 0)
      e.preventDefault()
      e.stopPropagation()

      const allowedJitter = 1.1
      if (supportsPressure) {
        bot.setControlState('jump', (e as any).pressure > 0.5)
      }
      const xDiff = Math.abs(e.pageX - capturedPointer.sourceX) > allowedJitter
      const yDiff = Math.abs(e.pageY - capturedPointer.sourceY) > allowedJitter
      if (!capturedPointer.activateCameraMove && (xDiff || yDiff)) {
        capturedPointer.activateCameraMove = true
      }
      if (capturedPointer.activateCameraMove) {
        clearTimeout(virtualClickTimeout)
      }

      onCameraMove({
        movementX: e.pageX - capturedPointer.x,
        movementY: e.pageY - capturedPointer.y,
        type: 'touchmove',
        stopPropagation: () => e.stopPropagation()
      } as CameraMoveEvent)
      capturedPointer.x = e.pageX
      capturedPointer.y = e.pageY
    }

    const pointerUpHandler = (e: PointerEvent) => {
      if (e.pointerId === undefined) return
      if (e.pointerId === joystickPointer.pointer?.pointerId) {
        handleMovementStickDelta()
        joystickPointer.pointer = null
        return
      }
      if (e.pointerId !== capturedPointer?.id) return
      clearTimeout(virtualClickTimeout)
      virtualClickTimeout = undefined

      if (virtualClickActive) {
        // button 0 is left click
        document.dispatchEvent(new MouseEvent('mouseup', { button: 0 }))
        virtualClickActive = false
      } else if (!capturedPointer.activateCameraMove && (Date.now() - capturedPointer.time < touchStartBreakingBlockMs)) {
        document.dispatchEvent(new MouseEvent('mousedown', { button: 2 }))
        worldInteractions.update()
        document.dispatchEvent(new MouseEvent('mouseup', { button: 2 }))
      }

      capturedPointer = undefined
      screenTouches--
    }

    const contextMenuHandler = (e: Event) => {
      e.preventDefault()
    }

    const blurHandler = () => {
      bot.clearControlStates()
    }

    cameraControlEl.addEventListener('pointerdown', pointerDownHandler, { signal })
    cameraControlEl.addEventListener('pointermove', pointerMoveHandler, { signal })
    cameraControlEl.addEventListener('pointerup', pointerUpHandler, { signal })
    cameraControlEl.addEventListener('pointercancel', pointerUpHandler, { signal })
    cameraControlEl.addEventListener('lostpointercapture', pointerUpHandler, { signal })
    cameraControlEl.addEventListener('contextmenu', contextMenuHandler, { signal })
    window.addEventListener('blur', blurHandler, { signal })
  }, [])

  return (
    <OverlayElement divRef={overlayRef} zIndex={zIndex} />
  )
}

const OverlayElement = ({ divRef, zIndex }: { divRef: React.RefObject<HTMLDivElement>, zIndex: number }) => {
  return <div
    className='game-interaction-overlay'
    ref={divRef}
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex,
      touchAction: 'none',
      userSelect: 'none'
    }}
  />
}

export default function GameInteractionOverlay ({ zIndex }: { zIndex: number }) {
  const modalStack = useSnapshot(activeModalStack)
  const { currentTouch } = useSnapshot(miscUiState)
  if (modalStack.length > 0 || !currentTouch) return null
  return <GameInteractionOverlayInner zIndex={zIndex} />
}
