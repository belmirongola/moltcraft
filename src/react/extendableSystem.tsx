import * as React from 'react'
import { ErrorBoundary } from '@zardoy/react-util'
import { showNotification } from '../react/NotificationProvider'

export type InjectUiPlace =
  | 'root'
  | 'button'
  | 'mainMenu'
  | 'mainMenuProvider'
  | 'chat'
  | 'chatProvider'
  | 'addServerOrConnect'
  | 'armorBar'
  | 'bossBarOverlay'
  | 'createWorld'
  | 'singleplayer'
  | 'deathScreen'
  | 'debugOverlay'
  | 'fullmap'
  | 'input'
  | 'notification'
  | 'optionsItems'
  | 'title'
  | 'slider'
  | 'serversList'
  | 'scoreboard'
  | 'select'

const wrapWithErrorBoundary = (
  Component: React.FC<any>,
  children: React.ReactNode,
  index: number
): React.ReactElement => {
  return (
    <ErrorBoundary
      key={index}
      renderError={(error) => {
        const componentName = Component.name || Component.displayName || 'Unknown'
        showNotification(
          `Registered component ${componentName} crashed!`,
          'Please report this. Use console for more.',
          true,
          undefined
        )
        return null
      }}
    >
      <Component>{children}</Component>
    </ErrorBoundary>
  )
}

export const withInjectableUi = <P extends object>(
  Component: React.ComponentType<P>,
  place: InjectUiPlace
) => {
  const WrappedComponent = (props: P) => {
    const components = window.mcraft?.ui?.registeredReactWrappers?.[place] || []

    // Start with the original component as the innermost
    let wrapped: React.ReactNode = <Component {...props} />

    // Wrap with registered components in reverse order
    // First registered component wraps last registered component, which wraps the original
    // e.g., if [A, B] are registered: A wraps B, B wraps Component
    for (let i = components.length - 1; i >= 0; i--) {
      const WrapperComponent = components[i]
      wrapped = wrapWithErrorBoundary(WrapperComponent, wrapped, i)
    }

    return <>{wrapped}</>
  }

  WrappedComponent.displayName = `withInjectableUi(${Component.displayName || Component.name || 'Component'}, ${place})`

  return WrappedComponent
}
