export type GamePhase = 'playing' | 'paused' | 'dead';

export interface ObstacleData {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glowing?: boolean;
}

export interface GameSession {
  score: number;
  coinsEarned: number;
  isNewBest: boolean;
}

export interface IAPPackage {
  id: string;
  coins: number;
  priceLabel: string;
}
