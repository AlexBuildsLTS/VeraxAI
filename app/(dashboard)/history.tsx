/**
 * app/(dashboard)/history.tsx
 * VeraxAI Archive & Vault Dashboard
 * ══════════════════════════════════════════════════════════════════════════════
 * PROTOCOL:
 * 1. ZERO-BLOCK BACKGROUND: Ambient Engine strictly uses pointerEvents="none".
 * 2. CALM WAVE ENGINE: Single central emitter anchored directly behind the Vault SVG.
 * 3. GEOMETRIC PHYSICS: 120fps UI-thread math (useFrameCallback) for seamless, slow drift.
 * 4. OPTIMIZED LIST: FlatList maintains exact `headerElement` reference to prevent input blur.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback, useMemo, useState, useEffect, memo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Rect, Path, Circle, Polygon, G } from 'react-native-svg';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
  withDelay,
  useFrameCallback,
} from 'react-native-reanimated';
import {
  AlertTriangle,
  Search,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react-native';

import { useHistoryData } from '../../hooks/queries/useHistoryData';
import { useDeleteVideo } from '../../hooks/mutations/useDeleteVideo';
import { THEME } from '@/constants/theme';

const IS_WEB = Platform.OS === 'web';

// ─── STRICT LIQUID NEON COLOR PALETTE ───
const DARK_NAVY = '#000012'; // Master Background
const CYAN = '#00F0FF';
const PURPLE = '#8A2BE2';
const GREEN = '#00c67d';
const PINK = '#FF007F';
const AMBER = '#FFB800';
const NAVY = '#1A3370';

type FilterStatus = 'all' | 'completed' | 'failed' | 'processing';

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  completed: { color: GREEN, label: 'COMPLETED' },
  failed: { color: PINK, label: 'FAILED' },
  queued: { color: AMBER, label: 'QUEUED' },
  downloading: { color: CYAN, label: 'DOWNLOADING' },
  transcribing: { color: CYAN, label: 'TRANSCRIBING' },
  ai_processing: { color: PURPLE, label: 'AI PROCESSING' },
  idle: { color: 'rgba(255,255,255,0.25)', label: 'IDLE' },
};

const PROCESSING_STATUSES = new Set([
  'queued',
  'downloading',
  'transcribing',
  'ai_processing',
]);

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 1: CALM SINGLE-WAVE INTERFERENCE ENGINE
// ══════════════════════════════════════════════════════════════════════════════
// ⚙️ CUSTOMIZATION GUIDE:
// - opacity interpolation: [0, 0.3, 0.05, 0] ensures NO BLINKING/POPPING.
// - duration: Set to 14000ms for a very calm, slow expansion.

interface RippleProps {
  color: string;
  delay: number;
  duration: number;
  maxScale: number;
}

const SingleRipple = React.memo(
  ({ color, delay, duration, maxScale }: RippleProps) => {
    const progress = useSharedValue(0);

    useEffect(() => {
      progress.value = withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration, easing: Easing.out(Easing.sin) }),
          -1,
          false, // Instantly resets to 0 to spawn the next ripple seamlessly
        ),
      );
    }, [delay, duration, progress]);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [
          { scale: interpolate(progress.value, [0, 1], [1, maxScale]) },
        ],
        // CRITICAL FIX: Starts at opacity 0 to prevent the sharp visual pop/blink.
        opacity: interpolate(
          progress.value,
          [0, 0.1, 0.6, 1],
          [0, 0.3, 0.05, 0],
        ),
        borderWidth: interpolate(progress.value, [0, 1], [2, 0]),
      };
    });

    return (
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 9999,
            borderColor: color,
            backgroundColor: 'transparent',
          },
          animatedStyle,
        ]}
      />
    );
  },
);
SingleRipple.displayName = 'SingleRipple';

interface EmitterProps {
  centerX: number;
  centerY: number;
  coreSize: number;
  color: string;
  maxWaveSize: number;
  waveCount: number;
  baseDuration: number;
}

const WaveEmitter = React.memo(
  ({
    centerX,
    centerY,
    coreSize,
    color,
    maxWaveSize,
    waveCount,
    baseDuration,
  }: EmitterProps) => {
    const stagger = baseDuration / waveCount;
    const maxScale = maxWaveSize / coreSize;

    // ⚙️ The Breathing Core Pulse
    // Animates the center ball itself so it glows and pulses naturally
    const corePulse = useSharedValue(0.4);

    useEffect(() => {
      corePulse.value = withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }, []);

    const coreStyle = useAnimatedStyle(() => ({
      opacity: interpolate(corePulse.value, [0.4, 1], [0.3, 0.8]),
      transform: [
        { scale: interpolate(corePulse.value, [0.4, 1], [0.85, 1.15]) },
      ],
    }));

    return (
      <View
        style={{
          position: 'absolute',
          left: centerX - coreSize / 2,
          top: centerY - coreSize / 2,
          width: coreSize,
          height: coreSize,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {Array.from({ length: waveCount }).map((_, index) => (
          <SingleRipple
            key={`ripple-${index}`}
            color={color}
            delay={index * stagger}
            duration={baseDuration}
            maxScale={maxScale}
          />
        ))}

        <Animated.View
          style={[
            coreStyle,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
              backgroundColor: color,
              shadowColor: color,
              shadowRadius: 12,
              shadowOpacity: 1,
              shadowOffset: { width: 0, height: 0 },
              ...(IS_WEB ? ({ boxShadow: `0 0 20px ${color}` } as any) : {}),
            },
          ]}
        />
      </View>
    );
  },
);
WaveEmitter.displayName = 'WaveEmitter';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2: MICRO-GEOMETRIC PHYSICS ENGINE (Hexagon, Tetrahedron, Diamond)
// ══════════════════════════════════════════════════════════════════════════════

interface GeometricShapeProps {
  type: 'hexagon' | 'tetrahedron' | 'diamond';
  color: string;
  size: number;
  initialX: number;
  initialY: number;
  velocityX: number;
  velocityY: number;
  rotationSpeed: number;
}

const FloatingShape = React.memo(
  ({
    type,
    color,
    size,
    initialX,
    initialY,
    velocityX,
    velocityY,
    rotationSpeed,
  }: GeometricShapeProps) => {
    const { width, height } = Dimensions.get('window');

    const x = useSharedValue(initialX);
    const y = useSharedValue(initialY);
    const rot = useSharedValue(0);

    // 120fps UI Thread loop. Ultra-smooth movement with ZERO JS bridge lag.
    useFrameCallback((frameInfo) => {
      if (frameInfo.timeSincePreviousFrame === null) return;
      const dt = frameInfo.timeSincePreviousFrame / 16.66;

      x.value += velocityX * dt;
      y.value += velocityY * dt;
      rot.value += rotationSpeed * dt;

      // Smooth Boundary Wrap
      if (x.value < -size * 2) x.value = width + size;
      if (x.value > width + size * 2) x.value = -size;
      if (y.value < -size * 2) y.value = height + size;
      if (y.value > height + size * 2) y.value = -size;
    });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: x.value },
        { translateY: y.value },
        { rotate: `${rot.value}rad` },
      ],
    }));

    return (
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            backgroundColor: color,
            opacity: 0.1,
          },
          animatedStyle,
        ]}
      />
    );
  },
);
FloatingShape.displayName = 'FloatingShape';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2: HARDWARE-ACCELERATED AMBIENT ENGINE
// ══════════════════════════════════════════════════════════════════════════════

interface AmbientRippleProps {
  color: string;
  delay: number;
  duration: number;
  maxSize: number;
}

const AmbientRipple = memo(
  ({ color, delay, duration, maxSize }: AmbientRippleProps) => {
    const progress = useSharedValue(0);

    useEffect(() => {
      progress.value = withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration, easing: Easing.out(Easing.sin) }),
          -1,
          false,
        ),
      );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
      width: interpolate(progress.value, [0, 1], [0, maxSize]),
      height: interpolate(progress.value, [0, 1], [0, maxSize]),
      borderRadius: interpolate(progress.value, [0, 1], [0, maxSize / 2]),
      opacity: interpolate(progress.value, [0, 0.1, 0.6, 1], [0, 0.4, 0.05, 0]),
      borderWidth: interpolate(progress.value, [0, 1], [24, 2]),
    }));

    return (
      <Animated.View
        style={[
          {
            position: 'absolute',
            borderColor: color,
            backgroundColor: 'transparent',
          },
          animatedStyle,
        ]}
      />
    );
  },
);
AmbientRipple.displayName = 'AmbientRipple';

const WanderingCore = memo(
  ({ coreSize, color, maxWaveSize, waveCount, baseDuration }: any) => {
    const { width, height } = Dimensions.get('window');
    const time = useSharedValue(0);
    const stagger = baseDuration / waveCount;

    useFrameCallback((frameInfo) => {
      if (frameInfo.timeSincePreviousFrame === null) return;
      time.value += frameInfo.timeSincePreviousFrame / 3000;
    });

    const animatedPosition = useAnimatedStyle(() => ({
      transform: [
        { translateX: width / 2 + Math.sin(time.value * 0.4) * (width * 0.3) },
        {
          translateY: height / 2 + Math.cos(time.value * 0.3) * (height * 0.2),
        },
      ],
    }));

    const corePulse = useSharedValue(0.6);
    useEffect(() => {
      corePulse.value = withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }, []);

    const coreStyle = useAnimatedStyle(() => ({
      opacity: interpolate(corePulse.value, [0.4, 1], [0.4, 1]),
      transform: [
        { scale: interpolate(corePulse.value, [0.4, 1], [0.8, 1.2]) },
      ],
    }));

    return (
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
          animatedPosition,
        ]}
      >
        {Array.from({ length: waveCount }).map((_, index) => (
          <AmbientRipple
            key={`ripple-${index}`}
            color={color}
            delay={index * stagger}
            duration={baseDuration}
            maxSize={maxWaveSize}
          />
        ))}
        <Animated.View
          style={[
            coreStyle,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
              backgroundColor: color,
              shadowColor: color,
              shadowRadius: 15,
              shadowOpacity: 1,
              shadowOffset: { width: 0, height: 0 },
              ...(IS_WEB ? ({ boxShadow: `0 0 20px ${color}` } as any) : {}),
            },
          ]}
        />
      </Animated.View>
    );
  },
);
WanderingCore.displayName = 'WanderingCore';

const OrganicOrb = memo(
  ({
    color,
    size,
    initialX,
    initialY,
    speedX,
    speedY,
    phaseOffsetX,
    phaseOffsetY,
    opacityBase,
  }: any) => {
    const { width, height } = Dimensions.get('window');
    const time = useSharedValue(0);

    useFrameCallback((frameInfo) => {
      if (frameInfo.timeSincePreviousFrame === null) return;
      time.value += frameInfo.timeSincePreviousFrame / 1000;
    });

    const animatedStyle = useAnimatedStyle(() => {
      const xOffset =
        Math.sin(time.value * speedX + phaseOffsetX) * (width * 0.3);
      const yOffset =
        Math.cos(time.value * speedY + phaseOffsetY) * (height * 0.2);
      const breathe = 1 + Math.sin(time.value * 0.5) * 0.15;
      return {
        transform: [
          { translateX: initialX + xOffset },
          { translateY: initialY + yOffset },
          { scale: breathe },
        ],
        opacity: opacityBase + Math.sin(time.value * 0.5) * 0.02,
      };
    });

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: -size / 2,
            left: -size / 2,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            ...(IS_WEB ? ({ filter: 'blur(60px)' } as any) : {}),
          },
          animatedStyle,
        ]}
      />
    );
  },
);
OrganicOrb.displayName = 'OrganicOrb';

const AmbientArchitecture = memo(() => {
  const { width, height } = Dimensions.get('window');
  const isDesktop = width >= 1024;
  const massiveWaveRadius = isDesktop ? width * 0.4 : height * 1.0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <OrganicOrb
        color={GREEN}
        size={width * 0.6}
        initialX={width * 0.8}
        initialY={height * 0.6}
        speedX={0.15}
        speedY={0.2}
        phaseOffsetX={Math.PI}
        phaseOffsetY={0}
        opacityBase={0.06}
      />
      <OrganicOrb
        color={CYAN}
        size={width * 0.4}
        initialX={width * 0.5}
        initialY={height * 0.8}
        speedX={0.25}
        speedY={0.1}
        phaseOffsetX={Math.PI / 4}
        phaseOffsetY={Math.PI}
        opacityBase={0.04}
      />
      {/*
       * VeraxAI Core Animation
       * ══════════════════════════════════════════════════════════════════════════════
       * <WanderingCore
       * coreSize={14}
       * color={PURPLE}
       * maxWaveSize={massiveWaveRadius}
       * baseDuration={12000}
       * />
       */}
    </View>
  );
});
AmbientArchitecture.displayName = 'AmbientArchitecture';

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 3: NATIVE SVG ANIMATION (THE VAULT)
// ══════════════════════════════════════════════════════════════════════════════
const AnimatedVaultIcon = () => {
  const floatY = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    rotation.value = withRepeat(
      withTiming(360, { duration: 6000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      style={[{ width: 120, height: 120, alignSelf: 'center' }, floatStyle]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 120 120">
        <Rect
          x="10"
          y="20"
          width="100"
          height="90"
          rx="12"
          fill="rgba(255,255,255,0.03)"
          stroke={CYAN}
          strokeWidth="2"
        />
        <Rect
          x="15"
          y="25"
          width="90"
          height="80"
          rx="8"
          fill="rgba(0, 240, 255, 0.05)"
        />
        <Path
          d="M 25 35 L 45 35"
          stroke={PURPLE}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <Path
          d="M 25 45 L 35 45"
          stroke={CYAN}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <Circle cx="90" cy="35" r="4" fill={GREEN} />
      </Svg>

      <Animated.View
        style={[
          { position: 'absolute', top: 40, left: 35, width: 50, height: 50 },
          spinStyle,
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 50 50">
          <Circle
            cx="25"
            cy="25"
            r="20"
            fill={NAVY}
            stroke={CYAN}
            strokeWidth="3"
          />
          <Circle
            cx="25"
            cy="25"
            r="14"
            fill="transparent"
            stroke={PURPLE}
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <Polygon points="25,5 28,12 22,12" fill={CYAN} />
          <Circle cx="25" cy="25" r="6" fill={CYAN} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 4: UI COMPONENTS (Pills, Pulses, Cards)
// ══════════════════════════════════════════════════════════════════════════════
const LivePulse = ({ color }: { color: string }) => {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 550 }),
        withTiming(1, { duration: 550 }),
      ),
      -1,
      true,
    );
  }, []);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        {
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: color,
          pointerEvents: 'none',
        },
        anim,
      ]}
    />
  );
};

const FilterChip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={{
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      marginRight: 8,
      borderWidth: 1,
      borderColor: active ? CYAN + '50' : 'rgba(255,255,255,0.08)',
      backgroundColor: active ? CYAN + '10' : 'transparent',
    }}
  >
    <Text
      style={{
        color: active ? CYAN : 'rgba(255,255,255,0.38)',
        fontSize: 11,
        fontWeight: active ? '700' : '400',
        letterSpacing: 0.4,
      }}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const HistoryCard = ({
  item,
  index,
  onPress,
  onDelete,
}: {
  item: any;
  index: number;
  onPress: () => void;
  onDelete: () => void;
}) => {
  const status = item.status ?? 'idle';
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;
  const isLive = PROCESSING_STATUSES.has(status);
  const isComplete = status === 'completed';
  const isFailed = status === 'failed';

  const dateStr = (() => {
    try {
      return new Date(item.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  })();

  const wordCount = item.transcripts?.[0]?.word_count;
  const readingMins = item.transcripts?.[0]?.reading_time_minutes;
  const hasSummary = !!item.ai_insights?.summary;

  const confirmDelete = () => {
    if (IS_WEB) {
      if (
        window.confirm(
          'Permanently delete this transcript and all AI insights?',
        )
      )
        onDelete();
    } else {
      Alert.alert(
        'Delete Transcript',
        'This permanently removes the video, transcript, and all AI insights.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onDelete },
        ],
      );
    }
  };

  return (
    <Animated.View entering={FadeInDown.duration(320).delay(index * 40)}>
      <TouchableOpacity
        onPress={isComplete ? onPress : undefined}
        onLongPress={confirmDelete}
        activeOpacity={0.78}
        style={{
          borderWidth: 1,
          borderColor: isLive
            ? cfg.color + '30'
            : isFailed
              ? PINK + '22'
              : 'rgba(255,255,255,0.07)',
          borderRadius: 14,
          backgroundColor: isLive
            ? cfg.color + '05'
            : isFailed
              ? PINK + '04'
              : 'rgba(255,255,255,0.015)',
          padding: 16,
          marginBottom: 10,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            marginBottom: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={2}
              style={{
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: '700',
                lineHeight: 19,
                letterSpacing: -0.1,
              }}
            >
              {item.title ?? item.youtube_url ?? 'Untitled'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {isLive ? <LivePulse color={cfg.color} /> : null}
            <TouchableOpacity
              onPress={confirmDelete}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={15} color="rgba(255,255,255,0.18)" />
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: wordCount || isFailed ? 8 : 0,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              borderWidth: 1,
              borderColor: cfg.color + '32',
              borderRadius: 20,
              paddingHorizontal: 9,
              paddingVertical: 3,
              backgroundColor: cfg.color + '0C',
            }}
          >
            <Text
              style={{
                color: cfg.color,
                fontSize: 9,
                fontWeight: '700',
                letterSpacing: 1.2,
              }}
            >
              {cfg.label}
            </Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.26)', fontSize: 11 }}>
            {dateStr}
          </Text>
          {hasSummary ? (
            <View
              style={{
                marginLeft: 'auto',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Star size={10} color={PURPLE} />
              <Text style={{ color: PURPLE, fontSize: 9, letterSpacing: 0.5 }}>
                AI
              </Text>
            </View>
          ) : null}
        </View>

        {wordCount || readingMins ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              marginBottom: isFailed ? 8 : 0,
            }}
          >
            {wordCount ? (
              <Text style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11 }}>
                {wordCount.toLocaleString()} words
              </Text>
            ) : null}
            {readingMins ? (
              <Text style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11 }}>
                {Math.round(readingMins)} min read
              </Text>
            ) : null}
          </View>
        ) : null}

        {isFailed && item.error_message ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 6,
              marginTop: 4,
              padding: 8,
              borderRadius: 8,
              backgroundColor: PINK + '08',
            }}
          >
            <AlertTriangle size={11} color={PINK} style={{ marginTop: 1 }} />
            <Text
              numberOfLines={2}
              style={{
                flex: 1,
                color: PINK + 'AA',
                fontSize: 11,
                lineHeight: 15,
              }}
            >
              {item.error_message}
            </Text>
          </View>
        ) : null}

        {isComplete ? (
          <View
            style={{
              position: 'absolute',
              right: 14,
              bottom: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text style={{ color: CYAN, fontSize: 9, letterSpacing: 0.8 }}>
              VIEW REPORT
            </Text>
            <Text style={{ color: CYAN, fontSize: 12 }}>→</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
};

const EmptyState = ({ filtered }: { filtered: boolean }) => (
  <View
    style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
    }}
  >
    <Text style={{ fontSize: 38, marginBottom: 14 }}>📭</Text>
    <Text
      style={{
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
      }}
    >
      {filtered
        ? 'No videos match this filter.'
        : 'No transcriptions yet.\nSubmit a video to get started.'}
    </Text>
  </View>
);

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 5: MAIN DASHBOARD LAYOUT
// ══════════════════════════════════════════════════════════════════════════════
export default function HistoryPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { data: videos = [], isLoading, refetch } = useHistoryData();
  const { mutate: deleteVideo } = useDeleteVideo();

  const filtered = useMemo(() => {
    let list = [...videos];
    if (filter === 'completed')
      list = list.filter((v) => v.status === 'completed');
    if (filter === 'failed') list = list.filter((v) => v.status === 'failed');
    if (filter === 'processing')
      list = list.filter((v) => PROCESSING_STATUSES.has(v.status ?? ''));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.title?.toLowerCase().includes(q) ||
          v.youtube_url?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [videos, filter, search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // ─── CRITICAL FIX: headerElement ───
  // Constructed externally to prevent React Native from destroying focus states
  // when the search text updates.
  const headerElement = (
    <View
      style={{
        width: '100%',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 0,
      }}
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <AnimatedVaultIcon />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(400).delay(100)}
        style={{ marginTop: 24 }}
      >
        <View
          style={{
            backgroundColor: GREEN + '10',
            borderColor: CYAN + '55',
            borderWidth: 1,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text style={{ color: GREEN, fontSize: 13, fontWeight: '800' }}>
            {videos.length}
          </Text>
          <Text
            style={{
              color: GREEN + 'CC',
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            PROCESSED
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(400).delay(200)}
        style={{
          height: 2,
          width: 80,
          backgroundColor: CYAN,
          marginTop: 30,
          marginBottom: 30,
          borderRadius: 999,
          shadowColor: CYAN,
          shadowOpacity: 0.8,
          shadowRadius: 15,
          shadowOffset: { width: 0, height: 0 },
        }}
      />

      <Animated.View
        entering={FadeInDown.duration(400).delay(300)}
        style={{ width: '100%', paddingBottom: 16 }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.02)',
            paddingHorizontal: 16,
            paddingVertical: Platform.OS === 'ios' ? 14 : 12,
          }}
        >
          <Search size={16} color="rgba(255,255,255,0.28)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search transcripts..."
            placeholderTextColor="rgba(255,255,255,0.22)"
            style={{
              flex: 1,
              color: '#FFFFFF',
              fontSize: 14,
              ...(IS_WEB ? ({ outline: 'none' } as any) : {}),
            }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
              <XCircle size={16} color="rgba(255,255,255,0.28)" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(400).delay(400)}
        style={{ width: '100%', marginBottom: 10 }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'completed', label: 'Completed' },
              { key: 'processing', label: 'Processing' },
              { key: 'failed', label: 'Failed' },
            ] as { key: FilterStatus; label: string }[]
          ).map(({ key, label }) => (
            <FilterChip
              key={key}
              label={label}
              active={filter === key}
              onPress={() => setFilter(key)}
            />
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: DARK_NAVY }}>
      {/* ── ISOLATED AMBIENT KERNEL ── */}
      {/* Fixed to the screen. pointerEvents="none" guarantees zero touch overlap */}
      <AmbientArchitecture />

      {isLoading ? (
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <ActivityIndicator color={CYAN} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={headerElement}
          ListEmptyComponent={
            <EmptyState filtered={filter !== 'all' || !!search.trim()} />
          }
          renderItem={({ item, index }) => (
            <HistoryCard
              item={item}
              index={index}
              onPress={() => router.push(`/video/${item.id}` as any)}
              onDelete={() => deleteVideo(item.id)}
            />
          )}
          contentContainerStyle={{
            paddingBottom: 120,
            flexGrow: 1,
            width: '100%',
            maxWidth: 672,
            alignSelf: 'center',
            paddingHorizontal: 16,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={CYAN}
              colors={[CYAN]}
            />
          }
        />
      )}
    </View>
  );
}
