import { proxy, useSnapshot } from 'valtio'
import { useState, useEffect, useMemo } from 'react'
import { isGameActive } from '../globalState'
import PlayerListOverlay from './PlayerListOverlay'
import './PlayerListOverlay.css'
import { lastConnectOptions } from './AppStatusProvider'

const MAX_ROWS_PER_COL = 10

type Players = typeof bot.players

export const tabListState = proxy({
  isOpen: false,
})

export default () => {
  const { isOpen } = useSnapshot(tabListState)

  const serverIp = lastConnectOptions.value?.server
  const [clientId, setClientId] = useState(bot._client.uuid)
  const [players, setPlayers] = useState<Players>({})
  const [counter, setCounter] = useState(0)

  useEffect(() => {
    function requestUpdate () {
      setPlayers(bot?.players ?? {})
    }

    bot.on('playerUpdated', () => requestUpdate())
    bot.on('playerJoined', () => requestUpdate())
    bot.on('playerLeft', () => requestUpdate())
    requestUpdate()
    const interval = setInterval(() => {
      requestUpdate()
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setPlayers(bot.players)
    if (bot.player) {
      setClientId(bot.player.uuid)
    } else {
      bot._client.on('player_info', () => {
        if (bot.player?.uuid) {
          setClientId(bot.player?.uuid)
        }
      })
    }

    const playerlistHeader = () => setCounter(prev => prev + 1)
    bot._client.on('playerlist_header', playerlistHeader)

    return () => {
      bot?._client.removeListener('playerlist_header', playerlistHeader)
    }
  }, [serverIp])


  const playersArray = Object.values(players).sort((a, b) => {
    if (a.username > b.username) return 1
    if (a.username < b.username) return -1
    return 0
  })
  const lists = [] as Array<typeof playersArray>

  let tempList = [] as typeof playersArray
  for (let i = 0; i < playersArray.length; i++) {
    tempList.push(playersArray[i])

    if ((i + 1) % MAX_ROWS_PER_COL === 0 || i + 1 === playersArray.length) {
      lists.push([...tempList])
      tempList = []
    }
  }

  if (!isOpen) return null

  return <PlayerListOverlay
    playersLists={lists}
    clientId={clientId}
    tablistHeader={bot.tablist.header}
    tablistFooter={bot.tablist.footer}
    serverIP={serverIp ?? ''}
  />
}
