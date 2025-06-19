import { NonReactiveState, RendererReactiveState } from '../../src/appViewer'

export const getDefaultRendererState = (): {
  reactive: RendererReactiveState
  nonReactive: NonReactiveState
} => {
  return {
    reactive: {
      world: {
        chunksLoaded: new Set(),
        heightmaps: new Map(),
        allChunksLoaded: true,
        mesherWork: false,
        intersectMedia: null
      },
      renderer: '',
      preventEscapeMenu: false
    },
    nonReactive: {
      world: {
        chunksLoaded: new Set(),
        chunksTotalNumber: 0,
      }
    }
  }
}
