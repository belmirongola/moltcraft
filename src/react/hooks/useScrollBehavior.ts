import { RefObject, useEffect, useRef } from 'react'

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
  const wasAtBottomBeforeOpen = useRef(false)
  const openedWasAtBottom = useRef(false)

  const isAtBottom = () => {
    if (!elementRef.current) return true
    const { scrollTop, scrollHeight, clientHeight } = elementRef.current
    return Math.abs(scrollHeight - clientHeight - scrollTop) < 1
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
  useEffect(() => {
    if (opened) {
      wasAtBottomBeforeOpen.current = isAtBottom()
      if (wasAtBottomBeforeOpen.current) {
        scrollToBottom()
      }
    } else if (elementRef.current) {
      scrollToBottom()
    }
  }, [opened])

  // Handle messages changes
  useEffect(() => {
    if ((!opened || (opened && openedWasAtBottom.current)) && elementRef.current) {
      openedWasAtBottom.current = false
      if (isAtBottom()) {
        scrollToBottom()
      }
    }
  }, [messages])

  // Update bottom state when messages change
  useEffect(() => {
    if (opened && elementRef.current) {
      openedWasAtBottom.current = isAtBottom()
    }
  }, [messages])

  return {
    scrollToBottom,
    isAtBottom
  }
}
