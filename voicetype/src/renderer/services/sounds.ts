// Audio context for playing sounds
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Generate a simple beep sound
function createBeep(frequency: number, duration: number, volume: number = 0.3): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, numSamples, sampleRate);
  const channel = buffer.getChannelData(0);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Sine wave with fade out
    const fadeOut = 1 - (i / numSamples);
    channel[i] = Math.sin(2 * Math.PI * frequency * t) * volume * fadeOut;
  }

  return buffer;
}

// Play an audio buffer
function playBuffer(buffer: AudioBuffer): void {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
}

// Start recording sound - ascending tone
export function playStartSound(): void {
  try {
    const ctx = getAudioContext();
    const duration = 0.15;
    const sampleRate = ctx.sampleRate;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, numSamples, sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      // Ascending frequency from 400 to 800 Hz
      const freq = 400 + (400 * (i / numSamples));
      const fadeOut = 1 - Math.pow(i / numSamples, 2);
      channel[i] = Math.sin(2 * Math.PI * freq * t) * 0.25 * fadeOut;
    }

    playBuffer(buffer);
  } catch (error) {
    console.warn('Could not play start sound:', error);
  }
}

// Stop recording sound - descending tone
export function playStopSound(): void {
  try {
    const ctx = getAudioContext();
    const duration = 0.15;
    const sampleRate = ctx.sampleRate;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, numSamples, sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      // Descending frequency from 600 to 300 Hz
      const freq = 600 - (300 * (i / numSamples));
      const fadeOut = 1 - Math.pow(i / numSamples, 2);
      channel[i] = Math.sin(2 * Math.PI * freq * t) * 0.25 * fadeOut;
    }

    playBuffer(buffer);
  } catch (error) {
    console.warn('Could not play stop sound:', error);
  }
}

// Success sound - pleasant double beep
export function playSuccessSound(): void {
  try {
    const buffer1 = createBeep(880, 0.08, 0.2);
    playBuffer(buffer1);
    setTimeout(() => {
      const buffer2 = createBeep(1100, 0.1, 0.2);
      playBuffer(buffer2);
    }, 100);
  } catch (error) {
    console.warn('Could not play success sound:', error);
  }
}

// Error sound - low buzz
export function playErrorSound(): void {
  try {
    const buffer = createBeep(200, 0.3, 0.3);
    playBuffer(buffer);
  } catch (error) {
    console.warn('Could not play error sound:', error);
  }
}
