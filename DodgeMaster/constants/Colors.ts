// Game color palette
export const Colors = {
  background: '#0A0A1A',       // deep navy-black
  backgroundAlt: '#0F0F28',    // slightly lighter for cards/overlays

  gold: '#FFD700',             // player color
  goldDim: '#B8960C',          // muted gold for disabled states
  goldGlow: 'rgba(255, 215, 0, 0.25)', // glow halo color

  white: '#FFFFFF',
  textPrimary: '#F0F0FF',
  textSecondary: '#9090B0',

  danger: '#FF4444',
  dangerGlow: 'rgba(255, 68, 68, 0.3)',

  // Obstacle colors — varied so players can read the field at a glance
  obstacles: ['#FF4444', '#FF6B35', '#C84B8A', '#9B59B6', '#E74C3C'],

  overlayDark: 'rgba(0, 0, 0, 0.75)',
  overlayDanger: 'rgba(180, 0, 0, 0.55)',

  buttonText: '#0A0A1A',       // dark text on gold buttons
  coinIcon: '#FFD700',
} as const;
