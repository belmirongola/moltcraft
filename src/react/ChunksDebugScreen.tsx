import { useEffect, useState } from 'react'
import { useUtilsEffect } from '@zardoy/react-util'
import { WorldRendererCommon } from 'renderer/viewer/lib/worldrendererCommon'
import { WorldRendererThree } from 'renderer/viewer/three/worldrendererThree'
import Screen from './Screen'
import ChunksDebug, { ChunkDebug } from './ChunksDebug'
import { useIsModalActive } from './utilsApp'

const Inner = () => {
  const [playerX, setPlayerX] = useState(Math.floor(worldView!.lastPos.x / 16) * 16)
  const [playerZ, setPlayerZ] = useState(Math.floor(worldView!.lastPos.z / 16) * 16)
  const [update, setUpdate] = useState(0)

  useUtilsEffect(({ interval }) => {
    interval(
      500,
      () => {
        setPlayerX(Math.floor(worldView!.lastPos.x / 16) * 16)
        setPlayerZ(Math.floor(worldView!.lastPos.z / 16) * 16)
        setUpdate(u => u + 1)
      }
    )
  }, [])

  const mapChunk = (key: string, state: ChunkDebug['state']): ChunkDebug => {
    const chunk = worldView!.debugChunksInfo[key]
    return {
      x: Number(key.split(',')[0]),
      z: Number(key.split(',')[1]),
      state,
      lines: [String(chunk?.loads.length ?? 0)],
      sidebarLines: [
        `loads: ${chunk.loads?.map(l => `${l.reason} ${l.dataLength} ${l.time}`).join('\n')}`,
        // `blockUpdates: ${chunk.blockUpdates}`,
      ],
    }
  }

  const chunksWaitingServer = Object.keys(worldView!.waitingSpiralChunksLoad).map(key => mapChunk(key, 'server-waiting'))

  const world = globalThis.world as WorldRendererThree

  const loadedSectionsChunks = Object.fromEntries(Object.keys(world.sectionObjects).map(sectionPos => {
    const [x, y, z] = sectionPos.split(',').map(Number)
    return [`${x},${z}`, true]
  }))

  const chunksWaitingClient = Object.keys(worldView!.loadedChunks).map(key => mapChunk(key, 'client-waiting'))

  const clientProcessingChunks = Object.keys(world.loadedChunks).map(key => mapChunk(key, 'client-processing'))

  const chunksDoneEmpty = Object.keys(world.finishedChunks)
    .filter(chunkPos => !loadedSectionsChunks[chunkPos])
    .map(key => mapChunk(key, 'done-empty'))

  const chunksDone = Object.keys(world.finishedChunks).map(key => mapChunk(key, 'done'))

  const allChunks = [
    ...chunksWaitingServer,
    ...chunksWaitingClient,
    ...clientProcessingChunks,
    ...chunksDone,
    ...chunksDoneEmpty,
  ]
  return <Screen title="Chunks Debug">
    <ChunksDebug
      chunks={allChunks}
      playerChunk={{
        x: playerX,
        z: playerZ
      }}
      maxDistance={worldView!.viewDistance}
      tileSize={32}
      fontSize={8}
    />
  </Screen>
}

export default () => {
  const isActive = useIsModalActive('chunks-debug')
  if (!isActive) return null

  return <Inner />
}
