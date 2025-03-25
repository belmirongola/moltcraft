import { RendererReactiveState } from '../../src/appViewer'

export const getDefaultRendererState = (): RendererReactiveState => {
  return {
    world: {
      chunksLoaded: [],
      chunksTotalNumber: 0,
      allChunksLoaded: true,
      mesherWork: false,
      intersectMedia: null
    },
    renderer: '',
    preventEscapeMenu: false
  }
}
