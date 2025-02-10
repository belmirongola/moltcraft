import { proxy, subscribe, useSnapshot } from 'valtio'
import { useEffect, useRef, useState } from 'react'
import './MineflayerPluginConsole.css'
import { miscUiState } from '../globalState'
import { useIsModalActive } from './utilsApp'

export type ConsoleMessage = {
  text: string
  isRepl?: boolean
  level?: 'log' | 'warn' | 'error'
  id: number
}

export const mineflayerConsoleState = proxy({
  onExecute: null as ((code: string) => void) | null,
  messages: [] as ConsoleMessage[],
  replEnabled: false,
  consoleEnabled: false,
})

const MessageLine = ({ message }: { message: ConsoleMessage }) => {
  const messageClass = message.isRepl ? 'console-message-repl' : message.level ? `console-message-${message.level}` : ''
  return (
    <li className={`console-message ${messageClass}`}>
      <span className="console-message-prefix">&gt;</span>
      {message.text}
    </li>
  )
}

export default () => {
  const opened = useIsModalActive('console')
  const usingTouch = useSnapshot(miscUiState).currentTouch
  const { messages, replEnabled, consoleEnabled, onExecute } = useSnapshot(mineflayerConsoleState)

  const consoleInput = useRef<HTMLInputElement>(null!)
  const consoleMessages = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (consoleMessages.current) {
      consoleMessages.current.scrollTop = consoleMessages.current.scrollHeight
    }
  }, [messages])

  const updateInputValue = (newValue: string) => {
    consoleInput.current.value = newValue
    setTimeout(() => {
      consoleInput.current.setSelectionRange(newValue.length, newValue.length)
    }, 0)
  }

  return (
    <>
      <div className={`console-wrapper console-messages-wrapper ${usingTouch ? 'display-mobile' : ''}`}>
        <div ref={consoleMessages} className={`console ${opened ? 'opened' : ''}`} id="console-messages">
          {!consoleEnabled && (
            <MessageLine
              key="console-disabled"
              message={{
                id: -1,
                text: 'Console is not enabled. Enable it in the plugin initialization settings.',
                level: 'error'
              }}
            />
          )}
          {messages.map((m) => (
            <MessageLine key={m.id} message={m} />
          ))}
        </div>
      </div>

      <div className={`console-wrapper console-input-wrapper ${usingTouch ? 'input-mobile' : ''}`} hidden={!opened}>
        <form
          className='console-input'
          onSubmit={(e) => {
            e.preventDefault()
            const code = consoleInput.current.value
            if (code) {
              onExecute?.(code)
              updateInputValue('')
            }
          }}
        >
          <div className="console-input-container">
            <span className="console-input-prefix">&gt;</span>
            <input
              defaultValue=''
              ref={consoleInput}
              type="text"
              className="console-input-field"
              id="consoleinput"
              spellCheck={false}
              autoComplete="off"
              disabled={!replEnabled}
              placeholder={replEnabled ? 'Enter JavaScript code (bot variable is available)' : 'REPL is not enabled'}
            />
          </div>
          <button type='submit' style={{ visibility: 'hidden', position: 'absolute' }} />
        </form>
      </div>
    </>
  )
}
