// Subtle Web Audio API sound effects — no external files needed
let ctx = null

function getCtx() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch (_) {}
  }
  return ctx
}

function tone(freq, type, duration, volume = 0.05) {
  const c = getCtx()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.connect(g); g.connect(c.destination)
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(volume, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  o.start(c.currentTime)
  o.stop(c.currentTime + duration)
}

export function playNav() {
  const c = getCtx()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.connect(g); g.connect(c.destination)
  o.type = 'sine'
  o.frequency.setValueAtTime(420, c.currentTime)
  o.frequency.exponentialRampToValueAtTime(560, c.currentTime + 0.04)
  g.gain.setValueAtTime(0.035, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.07)
  o.start(c.currentTime); o.stop(c.currentTime + 0.07)
}

export function playSuccess() {
  const c = getCtx()
  if (!c) return
  [[0, 523, 'sine'], [0.07, 659, 'sine'], [0.14, 784, 'sine']].forEach(([t, freq, type]) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.type = type; o.frequency.value = freq
    g.gain.setValueAtTime(0.055, c.currentTime + t)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + 0.18)
    o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.18)
  })
}

export function playError() {
  tone(180, 'sawtooth', 0.18, 0.04)
}

export function playClick() {
  tone(680, 'sine', 0.05, 0.03)
}
