/**
 * Qs Poke Buddy - Zepp OS Main App Entry Point
 */
App({
  globalData: {
    activePokemon: null,
    rules: null,
    syncLedger: null
  },
  onCreate(options) {
    console.log('=== Qs Poke Buddy Zepp OS App Starting ===')
  },
  onDestroy(options) {
    console.log('=== Qs Poke Buddy Zepp OS App Terminating ===')
  }
})
