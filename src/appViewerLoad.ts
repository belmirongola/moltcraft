import { subscribeKey } from 'valtio/utils'
import createGraphicsBackend from 'renderer/viewer/three/graphicsBackend'
import { options } from './optionsStorage'
import { appViewer } from './appViewer'
import { miscUiState } from './globalState'
import { watchOptionsAfterViewerInit } from './watchOptions'
import { showNotification } from './react/NotificationProvider'

const backends = [
  createGraphicsBackend,
]
const loadBackend = async () => {
  let backend = backends.find(backend => backend.id === options.activeRenderer)
  if (!backend) {
    showNotification(`No backend found for renderer ${options.activeRenderer}`, `Falling back to ${backends[0].id}`, true)
    backend = backends[0]
  }
  await appViewer.loadBackend(backend)
}
window.loadBackend = loadBackend
if (process.env.SINGLE_FILE_BUILD_MODE) {
  const unsub = subscribeKey(miscUiState, 'fsReady', () => {
    if (miscUiState.fsReady) {
      // don't do it earlier to load fs and display menu faster
      void loadBackend()
      unsub()
    }
  })
} else {
  setTimeout(() => {
    void loadBackend()
  })
}

const animLoop = () => {
  for (const fn of beforeRenderFrame) fn()
  requestAnimationFrame(animLoop)
}
requestAnimationFrame(animLoop)

watchOptionsAfterViewerInit()

// reset backend when renderer changes

subscribeKey(options, 'activeRenderer', async () => {
  if (appViewer.currentDisplay === 'world' && bot) {
    appViewer.resetBackend(true)
    await loadBackend()
    void appViewer.startWithBot()
  }
})
