/**
 * Strict Theme Constants
 * Maps directly to your tailwind.config.js for use in JS-only animations (like Reanimated)
 * where Tailwind classes cannot be used directly.
 */
export const THEME = {
  colors: {
    background: '#020205',
    card: 'rgba(255, 255, 255, 0.03)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    neon: {
      cyan: '#00F0FF',
      pink: '#FF007F',
      purple: '#8A2BE2',
      orange: '#FF4500',
      navy: '#000f2e',
      red: '#FF0000',
      obsidian: '#000b14',
      green: '#1BA16F',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#A1A1AA',
    },
  },
  animation: {
    spring: {
      damping: 15,
      stiffness: 300,
    },
    timing: {
      fast: 150,
      normal: 300,
      slow: 500,
    },
  },
} as const;
