import { preventThrottlingWithSound } from '../core/timers'
import { options } from '../optionsStorage'

customEvents.on('mineflayerBotCreated', () => {
  if (options.preventBackgroundTimeoutKick) {
    const unsub = preventThrottlingWithSound()
    bot.on('end', unsub)
  }
})
