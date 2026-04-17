/**
 * components/ui/Button.tsx
 * Primary action button with loading state.
 * Supports primary (neon cyan) and secondary (dark) variants.
 * Accepts optional children for icon+text combos.
 */

import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { cn } from '../../lib/utils';

interface ButtonProps {
  onPress: () => void;
  title?: string;
  isLoading?: boolean;
  className?: string;
  variant?: 'primary' | 'secondary';
  children?: React.ReactNode;
}

export const Button = ({
  onPress,
  title,
  isLoading,
  className,
  variant = 'primary',
  children,
}: ButtonProps) => {
  const baseClass =
    'flex-row items-center justify-center rounded-xl px-6 py-4 border';
  const variants = {
    primary: 'bg-[#00F0FF]/10 border-[#00F0FF]',
    secondary: 'bg-[#1A1A24] border-[#ffffff14]',
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLoading}
      activeOpacity={0.75}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      className={cn(baseClass, variants[variant], className)}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'primary' ? '#00F0FF' : '#FFF'} />
      ) : (
        <>
          {children}
          {title && (
            <Text
              className={cn(
                'text-base font-bold tracking-widest uppercase',
                children ? 'ml-2' : '',
                variant === 'primary' ? 'text-[#010218]' : 'text-white',
              )}
            >
              {title}
            </Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
};
