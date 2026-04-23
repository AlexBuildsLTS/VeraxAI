/**
 * components/ui/GlassCard.tsx
 * Core glassmorphism card container.
 * Accepts full ViewProps so callers control layout (flex-row, padding, etc.)
 * The inner content wrapper is removed to prevent flex direction overrides.
 */

import React from 'react';
import { View, ViewProps } from 'react-native';
import { cn } from '../../lib/utils';

export interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'cyan' | 'purple' | 'pink' | 'lime' | 'red' | 'green';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  glowColor = 'cyan',
  style,
  ...props
}) => {
  const glowStyles = {
    cyan: 'border-neon-cyan/20 shadow-[0_0_30px_rgba(0,240,255,0.05)]',
    purple: 'border-neon-purple/20 shadow-[0_0_30px_rgba(138,43,226,0.05)]',
    pink: 'border-neon-pink/20 shadow-[0_0_30px_rgba(255,0,127,0.05)]',
    lime: 'border-neon-lime/20 shadow-[0_0_30px_rgba(50,255,0,0.05)]',
    red: 'border-[#ff4d6d]/20 shadow-[0_0_30px_rgba(255,77,109,0.05)]',
    green: 'border-[#4ade80]/20 shadow-[0_0_30px_rgba(74,222,128,0.05)]',
  };

  return (
    <View
      className={cn(
        'rounded-[32px] border bg-[#0f172a]/40',
        glowStyles[glowColor],
        className,
      )}
      style={style}
      {...props}
    >
      {children}
    </View>
  );
};
