import { useMemo } from 'react'
import { fromFormattedString } from '@xmcl/text-component'
import { ErrorBoundary } from '@zardoy/react-util'
import { formatMessage } from '../chatUtils'
import MessageFormatted from './MessageFormatted'

/** like MessageFormatted, but receives raw string or json instead, uses window.loadedData */
export default ({ message, fallbackColor, className }: {
  message: string | Record<string, any> | null,
  fallbackColor?: string,
  className?: string
}) => {
  const messageJson = useMemo(() => {
    if (!message) return null
    // const transformIfNbt = (x) => {
    //   if (typeof x === 'object' && x?.type) return nbt.simplify(x) as Record<string, any>
    //   // if (Array.isArray(x)) return x.map(transformIfNbt)
    //   // if (typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, transformIfNbt(v)]))
    //   return x
    // }
    // if (typeof message === 'object' && message.text?.text?.type) {
    //   message.text.text = transformIfNbt(message.text.text)
    //   message.text.extra = transformIfNbt(message.text.extra)
    // }
    try {
      const texts = formatMessage(typeof message === 'string' ? fromFormattedString(message) : message)
      return texts.map(text => {
        return {
          ...text,
          color: text.color ?? fallbackColor,
        }
      })
    } catch (err) {
      console.error(err) // todo ensure its being logged
      return null
    }
  }, [message])

  return messageJson ? <ErrorBoundary renderError={(error) => {
    console.error(error)
    return <div>[text component crashed]</div>
  }}>
    <MessageFormatted parts={messageJson} className={className} />
  </ErrorBoundary> : null
}
