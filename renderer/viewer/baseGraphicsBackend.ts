export const getDefaultRendererState = () => {
  return {
    world: {
      chunksLoaded: 0,
      chunksTotal: 0,
      allChunksLoaded: true,
      mesherWork: false
    },
    renderer: '',
    preventEscapeMenu: false
  }
}
