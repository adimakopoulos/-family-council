// client/src/confetti.ts

import confetti from 'canvas-confetti';

export async function celebratePass(durationMs = 1200) {
  const confetti = (await import('canvas-confetti')).default;

  const end = Date.now() + durationMs;

  // Two side cannons + a few bursts while the timer runs
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 } });
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 } });

    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  // Center burst
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 }
  });
}
