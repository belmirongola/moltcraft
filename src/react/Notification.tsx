import { motion, AnimatePresence } from 'framer-motion'
import PixelartIcon from './PixelartIcon'

const duration = 0.2

// save pass: login

export default ({ type = 'message', message, subMessage = '', open, icon = '', action = undefined as (() => void) | undefined }) => {
  const isError = type === 'error'
  icon ||= isError ? 'alert' : 'message'

  return <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '-100%' }}
        transition={{ duration }}
        className={`app-notification ${isError ? 'error-notification' : ''}`}
        onClick={action}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '180px',
          whiteSpace: 'nowrap',
          fontSize: '9px',
          display: 'flex',
          gap: 4,
          alignItems: 'center',
          padding: '3px 5px',
          background: isError ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.7)',
          borderRadius: '0 0 0 5px',
          pointerEvents: action ? 'auto' : 'none',
          zIndex: 1200,
        }}
      >
        <PixelartIcon iconName={icon} styles={{ fontSize: 12 }} />
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <div style={{
            whiteSpace: 'normal',
          }}>
            {message}
          </div>
          <div style={{
            fontSize: '7px',
            whiteSpace: 'nowrap',
            color: 'lightgray',
          }}>
            {subMessage}
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
}
