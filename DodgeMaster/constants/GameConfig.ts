// All game-tuning values live here — never inline these
export const GAME_CONFIG = {
  TICK_RATE_MS: 33, // ~30fps game loop

  PLAYER_RADIUS: 15,

  OBSTACLE_MIN_RADIUS: 12,
  OBSTACLE_MAX_RADIUS: 28,

  // Speed in px per tick (30fps), scales with difficulty
  OBSTACLE_SPEED_MIN: 2.0,
  OBSTACLE_SPEED_MAX: 7.5,

  // How often obstacles spawn (ms between spawns)
  SPAWN_INTERVAL_MAX_MS: 2200, // easy (start)
  SPAWN_INTERVAL_MIN_MS: 450,  // hard (max difficulty)

  MAX_OBSTACLES: 18,

  // How many seconds until max difficulty is reached
  DIFFICULTY_RAMP_SECONDS: 90,

  // Invincibility window after a successful revive (ms)
  REVIVE_INVINCIBILITY_MS: 2500,

  // Score points earned per second survived
  SCORE_PER_SECOND: 1,

  // A milestone is reached every N score points — awards coins
  COINS_PER_MILESTONE_SCORE: 30,
} as const;
