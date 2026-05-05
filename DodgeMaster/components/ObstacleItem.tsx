import React, { memo } from 'react';
import { View } from 'react-native';
import type { ObstacleData } from '@/types';

interface Props {
  obstacle: ObstacleData;
}

/** Renders a single obstacle as an absolutely-positioned circle. */
export const ObstacleItem = memo(function ObstacleItem({ obstacle }: Props) {
  const size = obstacle.radius * 2;
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
        shadowColor: obstacle.color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: obstacle.radius * 0.6,
        elevation: 6,
      }}
    />
  );
});
