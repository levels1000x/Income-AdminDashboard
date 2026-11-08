// A short, local bell tone: no media download, trackers, or external audio service.
export class NotificationSound {
  private context: AudioContext | null = null
  private lastPlayed = 0
  get ready() {
    return this.context?.state === 'running'
  }
  async enable() {
    try {
      const Constructor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Constructor) return false
      this.context ??= new Constructor()
      await Promise.race([
        this.context.resume(),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ])
      return Boolean(this.ready)
    } catch {
      return false
    }
  }
  play(force = false) {
    if (!this.context || !this.ready) return false
    if (!force && Date.now() - this.lastPlayed < 3000) return false
    try {
      this.lastPlayed = Date.now()
      const start = this.context.currentTime
      for (const [frequency, delay, volume] of [
        [880, 0, 0.12],
        [1320, 0.1, 0.055],
      ]) {
        const oscillator = this.context.createOscillator()
        const gain = this.context.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0.0001, start + delay)
        gain.gain.exponentialRampToValueAtTime(volume, start + delay + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.65)
        oscillator.connect(gain)
        gain.connect(this.context.destination)
        oscillator.start(start + delay)
        oscillator.stop(start + delay + 0.7)
        oscillator.onended = () => {
          oscillator.disconnect()
          gain.disconnect()
        }
      }
      return true
    } catch {
      return false
    }
  }
  close() {
    const context = this.context
    this.context = null
    try {
      if (context) void context.close().catch(() => {})
    } catch {
      /* Optional audio must never prevent cleanup. */
    }
  }
}
