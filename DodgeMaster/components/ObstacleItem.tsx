import React, { memo } from 'react';
import { View } from 'react-native';
import type { ObstacleData } from '@/types';

interface Props {
  obstacle: ObstacleData;
}

/** Renders a single obstacle as an absolutely-positioned circle. */
export const ObstacleItem = memo(function ObstacleItem({ obstacle }: Props) {
  const size = obstacle.radius * 2;
  const glowing = obstacle.glowing ?? false;
  return (
    <View
      style={{
        position: 'absolute',
        left: obstacle.x - obstacle.radius,
        top: obstacle.y - obstacle.radius,
        width: size,
        height: size,
        borderRadius: obstacle.radius,
        backgroundColor: obstacle.color,
        shadowColor: glowing ? '#FF3030' : obstacle.color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: glowing ? 1.0 : 0.7,
        shadowRadius: glowing ? obstacle.radius * 1.8 : obstacle.radius * 0.6,
        elevation: glowing ? 12 : 6,
      }}
    />
  );
});
