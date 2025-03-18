import { useEffect, useState } from 'react'
import { useSnapshot } from 'valtio'
import { options } from '../optionsStorage'
import { activeModalStack } from '../globalState'
import PixelartIcon, { pixelartIcons } from './PixelartIcon'
import styles from './TouchInteractionHint.module.css'
import { useUsingTouch } from './utilsApp'

export default () => {
  const usingTouch = useUsingTouch()
  const modalStack = useSnapshot(activeModalStack)
  const { touchInteractionType } = useSnapshot(options)
  const [hintText, setHintText] = useState<string | null>(null)

  useEffect(() => {
    const update = () => {
      const cursorState = bot.mouse.getCursorState()
      if (cursorState.entity) {
        const entityName = cursorState.entity.displayName ?? cursorState.entity.name
        setHintText(`Attack ${entityName}`)
      } else {
        setHintText(null)
      }
    }

    // Initial update
    update()

    // Subscribe to physics ticks
    bot.on('physicsTick', update)

    return () => {
      bot?.removeListener('physicsTick', update)
    }
  }, [])

  if (!usingTouch || touchInteractionType !== 'classic' || modalStack.length > 0) return null
  if (!hintText) return null

  return (
    <div className={`${styles.hint_container} interaction-hint`}>
      <PixelartIcon iconName={pixelartIcons['sun-alt']} width={14} />
      <span className={styles.hint_text}>{hintText}</span>
    </div>
  )
}
