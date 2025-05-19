import { useEffect } from 'react'
import { proxy, useSnapshot } from 'valtio'
import { pointerLock } from '../utils'
import { miscUiState } from '../globalState'
import PixelartIcon, { pixelartIcons } from './PixelartIcon'
import { useUsingTouch } from './utilsApp'

export const displayHintsState = proxy({
  captureMouseHint: true
})

export default () => {
  const { captureMouseHint } = useSnapshot(displayHintsState)
  const { usingGamepadInput } = useSnapshot(miscUiState)
  const usingTouch = useUsingTouch()

  useEffect(() => {
    const listener = () => {
      if (pointerLock.hasPointerLock) {
        displayHintsState.captureMouseHint = false
      }
    }
    document.addEventListener('pointerlockchange', listener)

    return () => {
      document.removeEventListener('pointerlockchange', listener)
    }
  }, [])

  return <div style={{
    // below crosshair that is in center of screen
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: 'white',
    fontSize: '10px',
    whiteSpace: 'nowrap',
    fontWeight: 'bold',
    marginTop: '-16px',
    pointerEvents: 'none',
    textShadow: '0 0 1px black'
  }}>
    {captureMouseHint && !usingTouch && !usingGamepadInput && <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}>
      <PixelartIcon iconName={pixelartIcons['sun-alt']} />
      <div>Click to capture mouse</div>
    </div>}
  </div>
}
