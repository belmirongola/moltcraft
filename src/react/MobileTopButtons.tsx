import { useEffect, useRef } from 'react'
import { f3Keybinds } from '../controls'
import { watchValue } from '../optionsStorage'
import { showModal, miscUiState, activeModalStack, hideCurrentModal } from '../globalState'
import { showOptionsModal } from './SelectOption'
import useLongPress from './useLongPress'
import styles from './MobileTopButtons.module.css'


export default () => {
  const elRef = useRef<HTMLDivElement | null>(null)

  const showMobileControls = (bl) => {
    if (elRef.current) elRef.current.style.display = bl ? 'flex' : 'none'
  }

  useEffect(() => {
    watchValue(miscUiState, o => {
      showMobileControls(o.currentTouch)
    })
  }, [])

  const onLongPress = async () => {
    const select = await showOptionsModal('', f3Keybinds.filter(f3Keybind => {
      return f3Keybind.mobileTitle && (f3Keybind.enabled?.() ?? true)
    }).map(f3Keybind => {
      return `${f3Keybind.mobileTitle}${f3Keybind.key ? ` (F3+${f3Keybind.key})` : ''}`
    }))
    if (!select) return
    const f3Keybind = f3Keybinds.find(f3Keybind => f3Keybind.mobileTitle === select)
    if (f3Keybind) void f3Keybind.action()
  }

  const defaultOptions = {
    shouldPreventDefault: true,
    delay: 500,
  }
  const longPressEvent = useLongPress(onLongPress, () => {}, defaultOptions)


  const onChatLongPress = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
  }

  const onChatClick = () => {
    if (activeModalStack.at(-1)?.reactType === 'chat') {
      hideCurrentModal()
    } else {
      showModal({ reactType: 'chat' })
    }
  }

  const chatLongPressEvent = useLongPress(
    onChatLongPress,
    onChatClick,
    {
      shouldPreventDefault: true,
      delay: 300,
    }
  )

  // ios note: just don't use <button>
  return <div ref={elRef} className={styles['mobile-top-btns']} id="mobile-top">
    <div
      className={styles['debug-btn']} onPointerDown={(e) => {
        window.dispatchEvent(new MouseEvent('mousedown', { button: 1 }))
      }}
    >S
    </div>
    <div
      className={styles['debug-btn']} onPointerDown={(e) => {
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'F3' }))
        document.dispatchEvent(new KeyboardEvent('keyup', { code: 'F3' }))
      }} {...longPressEvent}
    >F3
    </div>
    <div
      className={styles['chat-btn']}
      {...chatLongPressEvent}
      onPointerUp={(e) => {
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab' }))
      }}
    />
    <div
      className={styles['pause-btn']} onPointerDown={(e) => {
        e.stopPropagation()
        showModal({ reactType: 'pause-screen' })
      }}
    />
  </div>
}
