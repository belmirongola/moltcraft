export const getDefaultReactiveState = () => {
  return {
    world: {
      chunksLoaded: 0,
      chunksTotal: 0,
      allChunksLoaded: true,
    },
    renderer: '',
    preventEscapeMenu: false
  }
}
