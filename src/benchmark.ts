import { Vec3 } from 'vec3'
import { WorldRendererCommon } from 'renderer/viewer/lib/worldrendererCommon'
import prettyBytes from 'pretty-bytes'
import { subscribe } from 'valtio'
import { downloadAndOpenMapFromUrl } from './downloadAndOpenFile'
import { activeModalStack, miscUiState } from './globalState'
import { disabledSettings, options } from './optionsStorage'
import { BenchmarkAdapterInfo, getAllInfoLines } from './benchmarkAdapter'
import { appQueryParams } from './appParams'

const DEFAULT_RENDER_DISTANCE = 8

const fixtures = {
  default: {
    url: 'https://bucket.mcraft.fun/Future CITY 4.4-slim.zip',
    spawn: [-133, 87, 309] as [number, number, number],
  },
}

Error.stackTraceLimit = Error.stackTraceLimit < 30 ? 30 : Error.stackTraceLimit

export const openBenchmark = async (renderDistance = DEFAULT_RENDER_DISTANCE) => {
  const fixture: {
    url: string
    spawn?: [number, number, number]
  } = appQueryParams.benchmarkMapZipUrl ? {
    url: appQueryParams.benchmarkMapZipUrl,
    spawn: appQueryParams.benchmarkPosition ? appQueryParams.benchmarkPosition.split(',').map(Number) as [number, number, number] : fixtures.default.spawn,
  } : fixtures.default

  let memoryUsageAverage = 0
  let memoryUsageSamples = 0
  let memoryUsageWorst = 0
  setInterval(() => {
    const memoryUsage = (window.performance as any)?.memory?.usedJSHeapSize
    if (memoryUsage) {
      memoryUsageAverage = (memoryUsageAverage * memoryUsageSamples + memoryUsage) / (memoryUsageSamples + 1)
      memoryUsageSamples++
      if (memoryUsage > memoryUsageWorst) {
        memoryUsageWorst = memoryUsage
      }
    }
  }, 200)

  let benchmarkName = `${fixture.url}`
  if (fixture.spawn) {
    benchmarkName += ` - ${fixture.spawn.join(',')}`
  }
  benchmarkName += ` - ${renderDistance}`
  const benchmarkAdapter: BenchmarkAdapterInfo = {
    get benchmarkName () {
      return benchmarkName
    },
    get worldLoadTimeSeconds () {
      return window.worldLoadTime
    },
    get mesherWorkersCount () {
      return (window.world as WorldRendererCommon).worldRendererConfig.mesherWorkers
    },
    get mesherProcessAvgMs () {
      return (window.world as WorldRendererCommon).workersProcessAverageTime
    },
    get mesherProcessWorstMs () {
      return (window.world as WorldRendererCommon).maxWorkersProcessTime
    },
    get averageRenderTimeMs () {
      return (window.world as WorldRendererCommon).renderTimeAvg
    },
    get worstRenderTimeMs () {
      return (window.world as WorldRendererCommon).renderTimeMax
    },
    get fpsAveragePrediction () {
      const avgRenderTime = (window.world as WorldRendererCommon).renderTimeAvg
      return 1000 / avgRenderTime
    },
    get fpsWorstPrediction () {
      const maxRenderTime = (window.world as WorldRendererCommon).renderTimeMax
      return 1000 / maxRenderTime
    },
    get fpsAverageReal () {
      return -1
    },
    get fpsWorstReal () {
      return -1
    },
    get memoryUsageAverage () {
      return prettyBytes(memoryUsageAverage)
    },
    get memoryUsageWorst () {
      return prettyBytes(memoryUsageWorst)
    },
    get gpuInfo () {
      return appViewer.rendererState.renderer
    },
    get hardwareConcurrency () {
      return navigator.hardwareConcurrency
    },
    get userAgent () {
      return navigator.userAgent
    },
  }
  window.benchmarkAdapter = benchmarkAdapter

  disabledSettings.value.add('renderDistance')
  options.renderDistance = renderDistance
  void downloadAndOpenMapFromUrl(fixture.url, undefined, {
    connectEvents: {
      serverCreated () {
        if (fixture.spawn) {
          localServer!.spawnPoint = new Vec3(...fixture.spawn)
          localServer!.on('newPlayer', (player) => {
            player.on('dataLoaded', () => {
              player.position = new Vec3(...fixture.spawn!)
            })
          })
        }
      },
    }
  })
  document.addEventListener('cypress-world-ready', () => {
    let stats = getAllInfoLines(window.benchmarkAdapter)
    if (appQueryParams.downloadBenchmark) {
      const a = document.createElement('a')
      a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(stats.join('\n'))
      a.download = `benchmark-${appViewer.backend?.id}.txt`
      a.click()
    }

    const panel = document.createElement('div')
    panel.style.position = 'fixed'
    panel.style.top = '10px'
    panel.style.right = '10px'
    panel.style.backgroundColor = 'rgba(0,0,0,0.8)'
    panel.style.color = 'white'
    panel.style.padding = '10px'
    panel.style.zIndex = '1000'
    panel.style.fontFamily = 'monospace'
    panel.id = 'benchmark-panel'

    const pre = document.createElement('pre')
    panel.appendChild(pre)

    pre.textContent = stats.join('\n')
    const updateStats = () => {
      stats = getAllInfoLines(window.benchmarkAdapter)
      pre.textContent = stats.join('\n')
    }

    document.body.appendChild(panel)
    // setInterval(updateStats, 100)
  })
}

document.addEventListener('pointerlockchange', (e) => {
  const panel = document.querySelector<HTMLDivElement>('#benchmark-panel')
  if (panel) {
    panel.hidden = !!document.pointerLockElement
  }
})

subscribe(activeModalStack, () => {
  const panel = document.querySelector<HTMLDivElement>('#benchmark-panel')
  if (panel && activeModalStack.length > 1) {
    panel.hidden = true
  }
})

export const registerOpenBenchmarkListener = () => {
  if (appQueryParams.openBenchmark) {
    void openBenchmark(appQueryParams.renderDistance ? +appQueryParams.renderDistance : undefined)
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyB' && e.shiftKey && !miscUiState.gameLoaded && activeModalStack.length === 0) {
      e.preventDefault()
      void openBenchmark()
    }
  })
}
