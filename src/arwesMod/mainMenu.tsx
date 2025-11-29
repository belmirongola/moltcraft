import React, { type ReactElement, type ReactNode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Animated,
  type AnimatedProp,
  Animator,
  BleepsProvider,
  type BleepsProviderSettings,
  BleepsOnAnimator,
  createThemeColor,
  createThemeMultiplier,
  createThemeUnit,
  FrameBase,
  FrameCorners,
  FrameNefrex,
  type FrameSettings,
  styleFrameClipOctagon,
  styleSteps,
  styleStrip,
  useBleeps,
  useFrameAssembler,
  Dots
} from '@arwes/react'
// import TitleImage from 'mc-assets/dist/other-textures/latest/gui/title/minecraft.png'
import Button from '../react/Button'
import TitleImage from './title.png'
import EditionImage from './edition.svg'

const addStyles = (css: string, id?: string): void => {
  if (id && document.getElementById(id)) {
    // remove it
    document.getElementById(id)?.remove()
  }

  const styleElement = document.createElement('style')
  if (id) {
    styleElement.id = id
  }
  styleElement.innerHTML = css
  document.body.appendChild(styleElement)
}

// Title scale factor - adjust this to scale both title and edition images
const TITLE_SCALE = 0.95

const theme = {
  space: createThemeUnit(index => `${index * 0.25}rem`),
  spacen: createThemeMultiplier(index => index * 4),
  colors: {
    background: 'hsla(180, 100%, 3%)',
    // Primary accent color: hsl(180deg 100% 61.5%)
    primary: createThemeColor(() => [180, 100, 61.5]),
    secondary: createThemeColor(i => [60, 100, 100 - i * 10])
  },
}

addStyles(`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  html,
  body {
    background: ${theme.colors.background};
  }
`, 'arwes-page-styles')

type BleepsNames = 'hover' | 'assemble' | 'type' | 'click'

const bleepsSettings: BleepsProviderSettings<BleepsNames> = {
  master: { volume: 0.5 },
  categories: {
    background: { volume: 0.25 },
    transition: { volume: 0.5 },
    interaction: { volume: 0.75 }
  },
  bleeps: {
    hover: {
      category: 'background',
      sources: [
        { src: 'https://next.arwes.dev/assets/sounds/hover.webm', type: 'audio/webm' },
        { src: 'https://next.arwes.dev/assets/sounds/hover.mp3', type: 'audio/mpeg' }
      ]
    },
    assemble: {
      category: 'transition',
      sources: [
        { src: 'https://next.arwes.dev/assets/sounds/assemble.webm', type: 'audio/webm' },
        { src: 'https://next.arwes.dev/assets/sounds/assemble.mp3', type: 'audio/mpeg' }
      ]
    },
    type: {
      category: 'transition',
      sources: [
        { src: 'https://next.arwes.dev/assets/sounds/type.webm', type: 'audio/webm' },
        { src: 'https://next.arwes.dev/assets/sounds/type.mp3', type: 'audio/mpeg' }
      ]
    },
    click: {
      category: 'interaction',
      sources: [
        { src: 'https://next.arwes.dev/assets/sounds/click.webm', type: 'audio/webm' },
        { src: 'https://next.arwes.dev/assets/sounds/click.mp3', type: 'audio/mpeg' }
      ]
    }
  }
}

const pageFrameSettings: FrameSettings = {
  elements: [
    {
      name: 'line',
      path: [
        ['M', 10, 10],
        ['h', '7%'],
        ['l', 10, 10],
        ['h', '7%']
      ]
    },
    {
      name: 'line',
      path: [
        ['M', '100%-10', 10],
        ['h', '-7%'],
        ['l', -10, 10],
        ['h', '-7%']
      ]
    },
    {
      name: 'line',
      path: [
        ['M', '100%-10', '100%-10'],
        ['h', '-7%'],
        ['l', -10, -10],
        ['h', '-7%']
      ]
    },
    {
      name: 'line',
      path: [
        ['M', '10', '100%-10'],
        ['h', '7%'],
        ['l', 10, -10],
        ['h', '7%']
      ]
    }
  ]
}

const PageFrame = (): ReactElement => {
  const frameRef = useRef<SVGSVGElement>(null)
  useFrameAssembler(frameRef)
  return <FrameBase elementRef={frameRef} className="page-frame" settings={pageFrameSettings} />
}

addStyles(`
  .page-frame {
    position: fixed;
    inset: 0;
    pointer-events: none;
  }
  .page-frame [data-name=line] {
    stroke: ${theme.colors.primary(5)};
    stroke-width: 1;
    fill: none;
  }
`, 'arwes-menu-button-styles')

const MainFrame = (): ReactElement => (
  <div className="main-frame" style={{ clipPath: styleFrameClipOctagon() }}>
    <FrameNefrex leftBottom rightTop />
  </div>
)

addStyles(`
  .main-frame {
    position: fixed;
    inset: 0;
  }
    /* contianer background color */
  .main-frame [data-name=bg] {
    color: rgba(2, 20, 20, 0.7);
  }
  .main-frame [data-name=line] {
    color: ${theme.colors.primary(5)};
  }
`)

const MenuButton = (props: { animated?: AnimatedProp; children: ReactNode }): ReactElement => {
  const bleeps = useBleeps<BleepsNames>()
  const frameRef = useRef<SVGSVGElement>(null)
  useFrameAssembler(frameRef)
  return (
    <Animated
      as="button"
      className="arwes-menu-button"
      animated={props.animated}
      onMouseEnter={() => bleeps.hover?.play()}
      onClick={() => bleeps.click?.play()}
    >
      <FrameCorners elementRef={frameRef} cornerLength={theme.spacen(2)} className="arwes-menu-button-frame" />
      <span className="arwes-menu-button-content">{props.children}</span>
    </Animated>
  )
}

addStyles(`
  .arwes-menu-button {
    position: relative;
    outline: none;
    border: none;
    padding: 0.25rem 1.75rem;
    line-height: 2rem;
    font-size: 0.75rem;
    font-family: inherit;
    letter-spacing: 0.2rem;
    text-transform: uppercase;
    color: ${theme.colors.secondary(5)};
    background: transparent;
    cursor: pointer;
    transition: color 0.2s ease-out, transform 0.2s ease-out;
  }
  .arwes-menu-button-frame {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .arwes-menu-button .arwes-frames-framesvg {
    width: 100%;
    height: 100%;
    transition: transform 0.2s ease-out;
  }
  .arwes-menu-button-content {
    position: relative;
    z-index: 1;
  }
  .arwes-menu-button [data-name=line] {
    color: ${theme.colors.secondary(5)};
    transition: color 0.2s ease-out;
  }
  .arwes-menu-button [data-name=bg] {
    color: ${theme.colors.secondary(9)};
    opacity: 0.4;
    transition: color 0.2s ease-out, opacity 0.2s ease-out;
  }
  .arwes-menu-button:hover,
  .arwes-menu-button:focus-visible {
    color: ${theme.colors.secondary(4)};
    transform: translateY(-2px);
  }
  .arwes-menu-button:hover [data-name=line],
  .arwes-menu-button:focus-visible [data-name=line] {
    color: ${theme.colors.secondary(4)};
  }
  .arwes-menu-button:hover [data-name=bg],
  .arwes-menu-button:focus-visible [data-name=bg] {
    color: ${theme.colors.secondary(7)};
    opacity: 0.6;
  }
`, 'arwes-page-styles')

interface ArwesMainMenuBaseProps {
  active?: boolean
  header?: ReactNode
  header2?: ReactNode
  title?: ReactNode
  separator?: ReactNode
  description?: ReactNode
  buttons?: ReactNode
  footer?: ReactNode
}

export const ArwesMainMenuBase: React.FC<ArwesMainMenuBaseProps> = ({
  active = true,
  header,
  header2,
  title,
  separator,
  description,
  buttons,
  footer
}) => {
  return (
    <BleepsProvider {...bleepsSettings}>
      <Animator active={active} duration={{ enter: 0.3, exit: 0.2 }}>
        <div className="arwes-page">
          <PageFrame />
          <BleepsOnAnimator<BleepsNames> transitions={{ entering: 'assemble' }} />
          <Animator combine manager="stagger">
            <Animated as="main" className="arwes-page-main" animated={[['scale', 0.92, 1]]}>
              <MainFrame />
              <Animator merge duration={{ delay: 0.25, enter: 0.25 }}>
                <BleepsOnAnimator<BleepsNames> transitions={{ entering: 'type' }} />
              </Animator>
              {header && (
                <Animator>
                  <Animated className="arwes-page-header" animated={[['x', -10, 0, 0]]}>
                    {header}
                  </Animated>
                </Animator>
              )}
              {header2 && (
                <Animator>
                  <Animated className="arwes-page-header2" animated={[['x', -10, 0, 0]]}>
                    {header2}
                  </Animated>
                </Animator>
              )}
              {title && (
                <Animator duration={{ offset: 0.4 }}>
                  <Animated as="h1" animated={['flicker', ['y', 15, 0, 0]]}>
                    {title}
                  </Animated>
                </Animator>
              )}
              {separator !== undefined && (
                <Animator>
                  <Animated
                    className="arwes-page-separator"
                    style={{
                      background: styleSteps({
                        length: 20,
                        color: 'currentcolor',
                        direction: '-45deg'
                      })
                    }}
                    animated={[['y', 20, 1, 0]]}
                  />
                </Animator>
              )}
              {description && (
                <Animator>
                  <Animated as="p" animated={[['y', 20, 0, 0]]}>
                    {description}
                  </Animated>
                </Animator>
              )}
              {buttons && (
                <div className="arwes-page-buttons">
                  {buttons}
                </div>
              )}
              {footer && (
                <Animator>
                  <Animated className="arwes-page-footer" animated={[['x', 10, 0, 0]]}>
                    {footer}
                  </Animated>
                </Animator>
              )}
            </Animated>
          </Animator>
        </div>
      </Animator>
    </BleepsProvider>
  )
}

addStyles(`
  .arwes-page {
    position: fixed;
    inset: 0;
    display: flex;
    text-align: center;
  }
  .arwes-page-main {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: auto;
    padding: 32px;
    width: 340px;
    height: 240px;
  }
  .arwes-page-separator {
    position: relative;
    width: 50%;
    height: 0.35rem;
    color: ${theme.colors.primary(8)};
  }
  .arwes-page-buttons {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
  }
  .arwes-page-header,
  .arwes-page-header2,
  .arwes-page-footer {
    position: absolute;
    font-size: 6px;
    letter-spacing: 0.08rem;
    color: ${theme.colors.primary(8)};
  }
  .arwes-page-header {
    right: 1.5rem;
    top: 0.5rem;
  }
  .arwes-page-header2 {
    right: 1.5rem;
    top: 1.5rem;
  }
  .arwes-page-footer {
    left: 1.5rem;
    bottom: 0.5rem;
  }
  .arwes-page h1 {
    line-height: 1;
    font-size: 1.5rem;
    font-weight: 300;
    font-family: inherit;
    color: ${theme.colors.primary(6)};
  }
  .arwes-page p {
    line-height: 1.6;
    text-wrap: pretty;
    font-size: 1rem;
    font-weight: 400;
    color: ${theme.colors.primary(7)};
  }
  .arwes-title-block {
    position: relative;
    width: ${300 * TITLE_SCALE}px;
    height: ${70 * TITLE_SCALE}px;
    margin: 0 auto;
  }
  .arwes-title-image {
    width: ${300 * TITLE_SCALE}px;
    display: block;
  }
  .arwes-edition-image {
    position: absolute;
    top: ${52 * TITLE_SCALE}px;
    left: 50%;
    transform: translateX(-50%);
    width: ${200 * TITLE_SCALE}px;
    height: ${18 * TITLE_SCALE}px;
    display: block;
    opacity: 0.9;
  }
`)

interface ArwesMainMenuProps {
  connectToServerAction: () => void
  singleplayerAction: () => void
  optionsAction: () => void
  onVersionStatusClick?: () => void
  onVersionTextClick?: () => void
  versionTitle?: string
  singleplayerAvailable?: boolean
}

export const ArwesMainMenu = (props: ArwesMainMenuProps) => {
  const { connectToServerAction, singleplayerAction, optionsAction, onVersionStatusClick, onVersionTextClick, versionTitle, singleplayerAvailable } = props
  const [active, setActive] = useState(true)

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent): void => {
      if (e.key === 'j' || e.key === 'J') {
        setActive(curr => !curr)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [])

  // Wrapper function that deactivates menu first, then calls the action
  const wrap = (action: () => void) => () => {
    setActive(false)
    setTimeout(() => {
      action()
    }, 300) // Wait for exit animation
  }

  return (
    <div style={{ }}>
      <ArwesMainMenuBase
        active={active}
        header={<span>Credits: Romel Perez, Zardoy</span>}
        title={
          <div className="arwes-title-block" style={{ marginTop: 0 }}>
            <img src={TitleImage} alt="Minecraft Title" className="arwes-title-image" />
            <img src={EditionImage} alt="Edition" className="arwes-edition-image" />
          </div>
        }
        separator={undefined}
        // description="ARWES is a web framework to build user interfaces based on futuristic science fiction designs, animations, and sound effects."
        buttons={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: 25, }}>
            {/* <Animator>
              <Animated animated={[['y', 20, 0, 0]]}>
                <MenuButton>Exit</MenuButton>
              </Animated>
            </Animator> */}
            <Animator>
              <Animated animated={[['y', 20, 0, 0]]}>
                <Button label="Singleplayer" onClick={wrap(singleplayerAction)} />
              </Animated>
            </Animator>
            <Animator>
              <Animated animated={[['y', 20, 0, 0]]}>
                <Button label="Multiplayer" onClick={wrap(connectToServerAction)} />
              </Animated>
            </Animator>
            <Animator>
              <Animated animated={[['y', 20, 0, 0]]}>
                <Button label="Options" onClick={wrap(optionsAction)} />
              </Animated>
            </Animator>
          </div>
        }
        footer={<span>| {versionTitle || 'v0.0.100'}</span>}
      />
    </div>
  )
}

window.mcraft.ui.registerReactWrapper('mainMenu', 'arwes', ArwesMainMenu)
