import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { cn } from '../../lib/utils';


interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'cyan' | 'purple' | 'pink' | 'lime';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  glowColor = 'cyan',
}) => {
  const glowStyles = {
    cyan: 'border-neon-cyan/20 shadow-[0_0_30px_rgba(0,240,255,0.05)]',
    purple: 'border-neon-purple/20 shadow-[0_0_30px_rgba(138,43,226,0.05)]',
    pink: 'border-neon-pink/20 shadow-[0_0_30px_rgba(255,0,127,0.05)]',
    lime: 'border-neon-lime/20 shadow-[0_0_30px_rgba(50,255,0,0.05)]',
  };

  return (
    <View
      className={cn(
        'relative overflow-hidden rounded-[32px] border bg-[#0f172a]/40', // Semi-transparent solid bg replaces BlurView
        glowStyles[glowColor],
        className,
      )}
    >
      {/* Content Layer */}
      <View className="relative z-10">{children}</View>
    </View>
  );
};
