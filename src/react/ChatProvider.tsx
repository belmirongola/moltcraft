import { useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import { formatMessage, isStringAllowed } from '../chatUtils'
import { getBuiltinCommandsList, tryHandleBuiltinCommand } from '../builtinCommands'
import { gameAdditionalState, hideCurrentModal, miscUiState } from '../globalState'
import { options } from '../optionsStorage'
import { viewerVersionState } from '../viewerConnector'
import Chat, { Message, fadeMessage } from './Chat'
import { useIsModalActive } from './utilsApp'
import { hideNotification, notificationProxy, showNotification } from './NotificationProvider'
import { getServerIndex, updateLoadedServerData } from './serversStorage'
import { lastConnectOptions } from './AppStatusProvider'
import { showOptionsModal } from './SelectOption'

export default () => {
  const [messages, setMessages] = useState([] as Message[])
  const isChatActive = useIsModalActive('chat')
  const lastMessageId = useRef(0)
  const usingTouch = useSnapshot(miscUiState).currentTouch
  const { chatSelect, messagesLimit, chatOpacity, chatOpacityOpened, chatVanillaRestrictions } = useSnapshot(options)
  const isUsingMicrosoftAuth = useMemo(() => !!lastConnectOptions.value?.authenticatedAccount, [])
  const { forwardChat } = useSnapshot(viewerVersionState)
  const { viewerConnection } = useSnapshot(gameAdditionalState)

  useEffect(() => {
    bot.addListener('message', (jsonMsg, position) => {
      if (position === 'game_info') return // ignore action bar messages, they are handled by the TitleProvider
      if (jsonMsg['unsigned']) {
        jsonMsg = jsonMsg['unsigned']
      }
      const parts = formatMessage(jsonMsg)

      setMessages(m => {
        lastMessageId.current++
        const newMessage: Message = {
          parts,
          id: lastMessageId.current,
          faded: false,
        }
        fadeMessage(newMessage, true, () => {
          // eslint-disable-next-line max-nested-callbacks
          setMessages(m => [...m])
        })
        return [...m, newMessage].slice(-messagesLimit)
      })
    })
  }, [])

  return <Chat
    chatVanillaRestrictions={chatVanillaRestrictions}
    allowSelection={chatSelect}
    usingTouch={!!usingTouch}
    opacity={(isChatActive ? chatOpacityOpened : chatOpacity) / 100}
    messages={messages}
    opened={isChatActive}
    placeholder={forwardChat || !viewerConnection ? undefined : 'Chat forwarding is not enabled in the plugin settings'}
    sendMessage={async (message) => {
      const builtinHandled = tryHandleBuiltinCommand(message)
      if (getServerIndex() !== undefined && (message.startsWith('/login') || message.startsWith('/register'))) {
        showNotification('Click here to save your password in browser for auto-login', undefined, false, undefined, () => {
          updateLoadedServerData((server) => {
            server.autoLogin ??= {}
            const password = message.split(' ')[1]
            server.autoLogin[bot.username] = password
            return { ...server }
          })
          hideNotification()
        })
        notificationProxy.id = 'auto-login'
        const listener = () => {
          hideNotification()
        }
        bot.on('kicked', listener)
        setTimeout(() => {
          bot.removeListener('kicked', listener)
        }, 2000)
      }
      if (!builtinHandled) {
        if (chatVanillaRestrictions && !miscUiState.flyingSquid) {
          const validation = isStringAllowed(message)
          if (!validation.valid) {
            const choice = await showOptionsModal(`Can't send invalid characters to vanilla server (${validation.invalid?.join(', ')}). You can use them only in command blocks.`, [
              'Remove Them & Send'
            ])
            if (!choice) return
            message = validation.clean!
          }
        }

        if (message) {
          bot.chat(message)
        }
      }
    }}
    onClose={() => {
      hideCurrentModal()
    }}
    fetchCompletionItems={async (triggerKind, completeValue) => {
      if ((triggerKind === 'explicit' || options.autoRequestCompletions)) {
        let items = [] as string[]
        try {
          items = await bot.tabComplete(completeValue, true, true)
        } catch (err) { }
        if (typeof items[0] === 'object') {
          // @ts-expect-error
          if (items[0].match) items = items.map(i => i.match)
        }
        if (completeValue === '/') {
          if (!items[0]?.startsWith('/')) {
            // normalize
            items = items.map(item => `/${item}`)
          }
          if (items.length) {
            items = [...items, ...getBuiltinCommandsList()]
          }
        }
        return items
      }
    }}
  />
}
