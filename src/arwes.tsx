import { createTheme, ThemeProvider as ArwesThemeProvider, Button, Arwes as ArwesRoot, Loading as ArwesLoading, Grid, Words as ArwesWords, Row, Col, Blockquote, Frame, Line } from 'arwes'
import { Puffs, Dots, MovingLines } from '@arwes/react-bgs'
import { Animator } from '@arwes/react-animator'
// import { Illuminator } from '@arwes/react-frames'
import { useEffect, useRef } from 'react'

const Background = () => {
  return (
    <>
      <Animator active duration={{ enter: 1.3 }}>
        <Parallax>
          {/* <Dots color="#003020" type="cross" distance={50} size={45} origin="center" style={{ zIndex: -1, position: 'relative' }} /> */}
          <Dots color="#006845" type="cross" distance={50} size={45} origin="center" style={{ zIndex: -1, position: 'relative' }} />
        </Parallax>
      </Animator>
      <Animator duration={{ interval: 100 }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: -1,
            // backgroundColor: '#000906',
            // backgroundImage:
            //     'radial-gradient(85% 85% at 50% 50%, hsla(185, 100%, 25%, 0.25) 0%, hsla(185, 100%, 25%, 0.12) 50%, hsla(185, 100%, 25%, 0) 100%)',
          }}
        >
          {/* <GridLines
lineColor='hsla(180, 100%, 75%, 0.05)'
distance={30}
/> */}
          {/* <Dots color="hsla(180, 100%, 75%, 0.05)" distance={30} /> */}
          <MovingLines lineColor="hsla(180, 100%, 75%, 0.07)" distance={30} sets={20} />
        </div>
      </Animator>
    </>
  )
}



const Parallax = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    document.addEventListener('mousemove', e => {
      if (ref.current) {
        const x = e.clientX / window.innerWidth
        const y = e.clientY / window.innerHeight
        const x2 = x * 2 - 1
        const y2 = y * 2 - 1
        // ref.current.style.transform = `translate(${(x2 * 0.3).toFixed(2)}%, ${(y2 * 0.3).toFixed(2)}%)`
      }
    })
    document.addEventListener('mouseleave', () => {
      if (ref.current) {
        ref.current.style.transform = ''
      }
    })

    return () => controller.abort()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        zIndex: -1,
        transition: 'transform 0.1s ease-out',
      }}
    >
      {children}
    </div>
  )
}
