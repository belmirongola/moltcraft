import { RefObject, useEffect, useLayoutEffect, useRef } from 'react'
import { pixelartIcons } from '../PixelartIcon'

export const useScrollBehavior = (
  elementRef: RefObject<HTMLElement>,
  {
    messages,
    opened
  }: {
    messages: readonly any[],
    opened?: boolean
  }
) => {
  const openedWasAtBottom = useRef(true) // before new messages

  const isAtBottom = () => {
    if (!elementRef.current) return true
    const { scrollTop, scrollHeight, clientHeight } = elementRef.current
    const distanceFromBottom = Math.abs(scrollHeight - clientHeight - scrollTop)
    return distanceFromBottom < 1
  }

  const scrollToBottom = () => {
    if (elementRef.current) {
      elementRef.current.scrollTop = elementRef.current.scrollHeight
    }
  }

  // Handle scroll position tracking
  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const handleScroll = () => {
      openedWasAtBottom.current = isAtBottom()
    }

    element.addEventListener('scroll', handleScroll)
    return () => element.removeEventListener('scroll', handleScroll)
  }, [])

  // Handle opened state changes
  useLayoutEffect(() => {
    if (opened) {
      openedWasAtBottom.current = true
    } else {
      scrollToBottom()
    }
  }, [opened])

  // Handle messages changes
  useLayoutEffect(() => {
    if ((!opened || (opened && openedWasAtBottom.current)) && elementRef.current) {
      scrollToBottom()
    }
  }, [messages])

  return {
    scrollToBottom,
    isAtBottom
  }
}
