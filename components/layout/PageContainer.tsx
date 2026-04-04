import React from 'react';
import { ViewProps, View, StyleSheet } from 'react-native';
import { cn } from '../../lib/utils';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PageContainerProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
  safeAreaTop?: boolean;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className,
  safeAreaTop = true,
  ...props
}) => {
  return (
    <View
      className={cn('flex-1 bg-[#020205]', className)}
      style={styles.full}
      {...props}
    >
      <SafeAreaView
        style={styles.full}
        edges={safeAreaTop ? ['top', 'left', 'right'] : ['left', 'right']}
      >
        <View style={styles.full}>{children}</View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  full: {
    flex: 1,
  },
});
