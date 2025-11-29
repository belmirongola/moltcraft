import { Animator, Dots } from '@arwes/react'
import BackgroundLargeWebp from './background-large.webp'

interface ScreenProps {
  children: React.ReactNode
  backdrop?: boolean | 'dirt'
}

export const ScreenBackdrop = () => {
  return <Animator duration={{ enter: 2, exit: 2 }}>
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }}>
      <img
        src={BackgroundLargeWebp}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          position: 'absolute',
          top: 0,
          left: 0
        }}
      />
      <Dots color="hsla(180, 100%, 75%, 0.4)" />
    </div>
  </Animator>
}

// const Screen = ({ children, backdrop }: ScreenProps) => {
//   return (
//     <>
//       {backdrop === 'dirt' ? <Background /> : null}
//       {children}
//     </>
//   )
// }

window.mcraft.ui.registerReactWrapper('screenDirtBg', 'arwes', ScreenBackdrop)
