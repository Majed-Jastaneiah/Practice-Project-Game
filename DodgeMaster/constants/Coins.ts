// Coin economy — never hardcode these values anywhere else
export const COIN_VALUES = {
  NEW_PLAYER_BONUS: 30,    // granted on first app launch
  DAILY_LOGIN_BONUS: 10,   // granted once per calendar day
  AD_WATCH_REWARD: 20,     // rewarded after watching a full ad
  MILESTONE_REWARD: 5,     // earned every COINS_PER_MILESTONE_SCORE points

  REVIVE_COST: 5,          // spent to revive mid-game
} as const;

// Placeholder IAP packages — prices/IDs wired up when IAP is configured
export const IAP_PACKAGES = [
  { id: 'coins_100',  coins: 100,  priceLabel: '$0.99' },
  { id: 'coins_500',  coins: 500,  priceLabel: '$3.99' },
  { id: 'coins_1200', coins: 1200, priceLabel: '$7.99' },
] as const;
