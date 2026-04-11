/**
 * components/ui/Input.tsx
 * Core design system text input.
 * Dark-mode-first with neon cyan label and focus states.
 * Supports optional label, error message, and all standard TextInput props.
 */

import React from 'react';
import { TextInput, TextInputProps, View, Text } from 'react-native';
import { cn } from '../../lib/utils';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <View className="w-full mb-4">
        {label && (
          <Text className="text-neon-cyan font-black text-[10px] tracking-widest uppercase mb-2 ml-1">
            {label}
          </Text>
        )}
        <TextInput
          ref={ref}
          placeholderTextColor="#475569"
          className={cn(
            'w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4 text-white text-sm font-medium outline-none',
            'focus:border-neon-cyan/50',
            error && 'border-neon-pink/50 focus:border-neon-pink',
            className,
          )}
          {...props}
        />
        {error && (
          <Text className="text-neon-pink text-[10px] font-bold uppercase tracking-widest mt-2 ml-1">
            {error}
          </Text>
        )}
      </View>
    );
  },
);
Input.displayName = 'Input';
