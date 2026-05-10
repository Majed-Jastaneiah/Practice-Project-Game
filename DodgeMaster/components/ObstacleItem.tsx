import React, { memo } from 'react';
import { View, Text } from 'react-native';
import type { ObstacleData } from '@/types';

// Extends ObstacleData with optional fields set by EnhancedObstacle at runtime.
interface ObstacleRenderData extends ObstacleData {
  icon?: string;
}

interface Props {
  obstacle: ObstacleRenderData;
}

/** Renders a single obstacle (or power-up collectible) as an absolutely-positioned circle. */
export const ObstacleItem = memo(function ObstacleItem({ obstacle }: Props) {
  const size      = obstacle.radius * 2;
  const glowing   = obstacle.glowing ?? false;
  const icon      = obstacle.icon;
  const isPowerUp = !!icon;

  const shadowColor   = isPowerUp ? '#FFD700' : (glowing ? '#FF3030' : obstacle.color);
  const shadowOpacity = (glowing || isPowerUp) ? 1.0 : 0.7;
  const shadowRadius  = (glowing || isPowerUp) ? obstacle.radius * 1.8 : obstacle.radius * 0.6;
  const elevation     = (glowing || isPowerUp) ? 12 : 6;

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
        shadowColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity,
        shadowRadius,
        elevation,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon ? (
        <Text style={{ fontSize: obstacle.radius * 0.9, lineHeight: obstacle.radius * 1.2, textAlign: 'center' }}>
          {icon}
        </Text>
      ) : null}
    </View>
  );
});
