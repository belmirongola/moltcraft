import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './DiveTransition.module.css'

const durationInSeconds = 0.3
const durationInMs = durationInSeconds * 1000

export default ({ children, open, isError = false }) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!mounted && open) {
      setMounted(true)
    }
    let timeout
    if (mounted && !open) {
      timeout = setTimeout(() => {
        setMounted(false)
      }, durationInMs)
    }
    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [open])

  if (!mounted) return null

  return (
    <AnimatePresence initial={false}>
      {open && (
        <div className={styles.container}>
          <motion.div
            initial={false}
            exit={isError ? undefined : { opacity: 0 }}
            transition={{ duration: durationInSeconds }}
            className={styles.main}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
