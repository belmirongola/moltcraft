import { proxy, useSnapshot } from 'valtio'
import { useEffect, useRef } from 'react'
import type { UIDefinition } from 'mcraft-fun-mineflayer/build/customChannel'
import MessageFormattedString from './MessageFormattedString'
import { useUiMotion } from './uiMotion'

export const mineflayerPluginHudState = proxy({
  ui: [] as Array<UIDefinition & { id: string }>,
})

const TextElement = ({ text, x, y, motion = true, formatted = true, css = '', onTab = false }: UIDefinition & { type: 'text' }) => {
  const motionRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useUiMotion(motionRef, motion)

  useEffect(() => {
    if (!css) return
    innerRef.current!.style.cssText = css
  }, [css])

  if (onTab && !document.hidden) return null

  return (
    <div
      ref={motionRef}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transition: motion ? 'transform 0.1s ease-out' : 'none',
      }}
    >
      <div ref={innerRef}>
        {formatted ? <MessageFormattedString message={text} /> : text}
      </div>
    </div>
  )
}

const ImageElement = ({ url, x, y, width, height }: UIDefinition & { type: 'image' }) => {
  return (
    <img
      src={url}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height
      }}
      alt=""
    />
  )
}

export default () => {
  const { ui } = useSnapshot(mineflayerPluginHudState)

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {ui.map((element, index) => {
        if (element.type === 'lil') return null // Handled elsewhere
        if (element.type === 'text') return <TextElement key={index} {...element} />
        if (element.type === 'image') return <ImageElement key={index} {...element} />
        return null
      })}
    </div>
  )
}
