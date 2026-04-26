import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowBigLeftDash,
  Activity,
  Zap,
  Globe,
  Server,
  Database as DbIcon,
  ShieldAlert,
  CloudLightning,
  MonitorSmartphone,
  Link2,
  Sparkles,
  Cpu,
} from 'lucide-react-native';
import Svg, { Path, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  withDelay,
  Easing,
  useFrameCallback,
} from 'react-native-reanimated';

import { GlassCard } from '../../../components/ui/GlassCard';
import { cn } from '../../../lib/utils';

// ─── CONSTANTS & THEME ───────────────────────────────────────────────────────
const IS_WEB = Platform.OS === 'web';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const THEME = {
  obsidian: '#000012', // Reverted to original
  panelBg: '#0A0A1A',
  cyan: '#00F0FF',
  purple: '#8A2BE2',
  pink: '#FF007F',
  green: '#32FF00',
  gold: '#FFD700',
  red: '#FF3366',
  nodeBorder: '#334155',
  textMain: '#F8FAFC',
  textMuted: '#94A3B8',
  glass: 'rgba(10, 10, 30, 0.8)',
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ─── PIPELINE DATA ───────────────────────────────────────────────────────────
const NODE_CONFIG = {
  client: { label: 'CLIENT APP', sub: 'User Interface', icon: MonitorSmartphone },
  cobalt: { label: 'TIER 1 EXTRACT', sub: 'Cobalt API', icon: Globe },
  ytdlp: { label: 'TIER 2 EXTRACT', sub: 'WASM Proxy', icon: Zap },
  edge: { label: 'SUPABASE EDGE', sub: 'Central Router', icon: Activity },
  stt: { label: 'SPEECH-TO-TEXT', sub: 'Deepgram Engine', icon: CloudLightning },
  gemini: { label: 'CLOUD ENGINE', sub: 'Gemini 3.1', icon: Sparkles },
  gemma: { label: 'LOCAL ENGINE', sub: 'Gemma 4 Edge', icon: Cpu },
  db: { label: 'DB VAULT', sub: 'Secure Ledger', icon: DbIcon },
};

const DESKTOP_LAYOUT = {
  client: { x: 10, y: 50 },
  cobalt: { x: 30, y: 30 },
  ytdlp: { x: 30, y: 70 },
  edge: { x: 50, y: 50 },
  stt: { x: 65, y: 50 },
  gemini: { x: 85, y: 25 },
  gemma: { x: 30, y: 85 },
  db: { x: 85, y: 75 },
};

const MOBILE_LAYOUT = {
  client: { x: 50, y: 5 },
  cobalt: { x: 25, y: 18 },
  ytdlp: { x: 75, y: 18 },
  edge: { x: 50, y: 35 },
  stt: { x: 50, y: 52 },
  gemini: { x: 25, y: 70 },
  gemma: { x: 75, y: 70 },
  db: { x: 50, y: 90 },
};

const EDGES = [
  { id: 'client-cobalt', from: 'client', to: 'cobalt', type: 'standard' },
  { id: 'client-ytdlp', from: 'client', to: 'ytdlp', type: 'custom' },
  { id: 'cobalt-edge', from: 'cobalt', to: 'edge', type: 'standard' },
  { id: 'ytdlp-edge', from: 'ytdlp', to: 'edge', type: 'custom' },
  { id: 'edge-stt', from: 'edge', to: 'stt', type: 'both' },
  { id: 'stt-edge', from: 'stt', to: 'edge', type: 'both' },
  { id: 'edge-gemini', from: 'edge', to: 'gemini', type: 'cloud' },
  { id: 'gemini-db', from: 'gemini', to: 'db', type: 'cloud' },
  { id: 'edge-client', from: 'edge', to: 'client', type: 'local' },
  { id: 'client-gemma', from: 'client', to: 'gemma', type: 'local' },
  { id: 'gemma-db', from: 'gemma', to: 'db', type: 'local' },
];

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 1: NEBULA AMBIENT ENGINE
// ══════════════════════════════════════════════════════════════════════════════

const OrganicOrb = memo(({ color, size, initialX, initialY, speedX, speedY, phaseOffsetX, phaseOffsetY, opacityBase }: any) => {
  const time = useSharedValue(0);
  useFrameCallback((frameInfo) => { if (frameInfo.timeSincePreviousFrame === null) return; time.value += frameInfo.timeSincePreviousFrame / 1000; });
  const animatedStyle = useAnimatedStyle(() => {
    const xOffset = Math.sin(time.value * speedX + phaseOffsetX) * (SCREEN_WIDTH * 0.3);
    const yOffset = Math.cos(time.value * speedY + phaseOffsetY) * (SCREEN_HEIGHT * 0.2);
    const breathe = 1 + Math.sin(time.value * 0.5) * 0.15;
    return { transform: [{ translateX: initialX + xOffset }, { translateY: initialY + yOffset }, { scale: breathe }], opacity: opacityBase + Math.sin(time.value * 0.5) * 0.02 };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -size / 2, left: -size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: color, ...(IS_WEB ? ({ filter: 'blur(60px)' } as any) : {}) }, animatedStyle]} />;
});

const AmbientArchitecture = memo(() => {
  const { width, height } = Dimensions.get('window');
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <OrganicOrb color={THEME.cyan} size={width * 0.5} initialX={width * 0.2} initialY={height * 0.3} speedX={0.2} speedY={0.15} phaseOffsetX={0} phaseOffsetY={Math.PI / 2} opacityBase={0.06} />
      <OrganicOrb color={THEME.purple} size={width * 0.6} initialX={width * 0.8} initialY={height * 0.6} speedX={0.15} speedY={0.25} phaseOffsetX={Math.PI} phaseOffsetY={0} opacityBase={0.08} />
    </View>
  );
});

const AnimatedLedgerIcon = memo(() => {
  const floatY = useSharedValue(0);
  useEffect(() => { floatY.value = withRepeat(withSequence(withTiming(-6, { duration: 2500, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) })), -1, true); }, []);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatY.value }] }));
  return (
    <Animated.View style={[{ width: 100, height: 100, alignItems: 'center', justifyContent: 'center' }, floatStyle]}>
      <Svg width="80" height="80" viewBox="0 0 120 120">
        <Path d="M 20 40 L 20 90 A 40 15 0 0 0 100 90 L 100 40" fill="rgba(138,43,226,0.1)" stroke={THEME.purple} strokeWidth="2" />
        <Path d="M 20 40 A 40 15 0 0 0 100 40 A 40 15 0 0 0 20 40" fill="rgba(0,240,255,0.1)" stroke={THEME.cyan} strokeWidth="2" />
      </Svg>
    </Animated.View>
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 2: PIPELINE COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

const PipelineEdge = memo(({ edge, fromPos, toPos, isActive, flowProgress }: any) => {
  if (!fromPos || !toPos) return null;

  const dx = Math.abs(toPos.x - fromPos.x);
  const dy = Math.abs(toPos.y - fromPos.y);
  
  // Dynamic control points based on orientation
  const isVertical = dy > dx;
  const offset = (isVertical ? dy : dx) * 0.4;
  
  const pathData = isVertical
    ? `M ${fromPos.x} ${fromPos.y} C ${fromPos.x} ${fromPos.y + offset}, ${toPos.x} ${toPos.y - offset}, ${toPos.x} ${toPos.y}`
    : `M ${fromPos.x} ${fromPos.y} C ${fromPos.x + offset} ${fromPos.y}, ${toPos.x - offset} ${toPos.y}, ${toPos.x} ${toPos.y}`;
  
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: flowProgress.value,
  }));

  return (
    <G>
      <Path 
        d={pathData} 
        fill="none" 
        stroke={isActive ? THEME.cyan : THEME.nodeBorder} 
        strokeWidth="2" 
        opacity={isActive ? 1 : 0.2} 
      />
      {isActive && (
        <AnimatedPath
          d={pathData}
          fill="none"
          stroke={THEME.cyan}
          strokeWidth="3"
          strokeDasharray="10 10"
          animatedProps={animatedProps}
        />
      )}
    </G>
  );
});

const PipelineNode = memo(({ node, pos, isActive, isMobile }: any) => {
  if (!pos) return null;
  const Icon = node.icon;
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      scale.value = withSequence(withTiming(1.1, { duration: 200 }), withTiming(1.05, { duration: 200 }));
    } else {
      scale.value = withTiming(1, { duration: 300 });
    }
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: isActive ? THEME.cyan : THEME.nodeBorder,
    backgroundColor: isActive ? 'rgba(0, 240, 255, 0.15)' : 'rgba(15, 15, 35, 0.95)',
    shadowColor: THEME.cyan,
    shadowOpacity: isActive ? 0.6 : 0,
    shadowRadius: 12,
    elevation: isActive ? 8 : 0,
  }));

  const nodeWidth = isMobile ? 90 : 130;
  const nodeHeight = isMobile ? 44 : 56;

  return (
    <Animated.View 
      style={[
        styles.nodeCard, 
        { 
          left: pos.x - nodeWidth / 2, 
          top: pos.y - nodeHeight / 2,
          width: nodeWidth,
          height: nodeHeight,
        },
        animatedStyle
      ]}
    >
      <View className={cn("p-1 rounded-lg mb-0.5", isActive ? "bg-cyan/30" : "bg-white/5")}>
        <Icon size={isMobile ? 10 : 14} color={isActive ? THEME.cyan : THEME.textMuted} />
      </View>
      <Text style={[styles.nodeLabel, isActive && { color: '#FFF' }, isMobile && { fontSize: 7 }]}>{node.label}</Text>
      <Text style={[styles.nodeSub, isActive && { color: THEME.cyan }, isMobile && { fontSize: 6 }]}>{node.sub}</Text>
    </Animated.View>
  );
});

const PipelineSimulator = memo(({ urlType, processMode, runTrigger, isRunning, onComplete }: any) => {
  const [activeNodes, setActiveNodes] = useState<Record<string, boolean>>({});
  const [activePaths, setActivePaths] = useState<Record<string, boolean>>({});
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const flowProgress = useSharedValue(0);

  const isMobile = containerSize.width > 0 && containerSize.width < 600;

  const nodePositions = useMemo(() => {
    if (containerSize.width === 0) return {};
    const layout = isMobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT;
    const positions: Record<string, { x: number, y: number }> = {};
    Object.keys(layout).forEach(id => {
      const config = layout[id as keyof typeof layout];
      positions[id] = {
        x: (config.x / 100) * containerSize.width,
        y: (config.y / 100) * containerSize.height,
      };
    });
    return positions;
  }, [containerSize, isMobile]);

  useEffect(() => {
    flowProgress.value = withRepeat(withTiming(-20, { duration: 500, easing: Easing.linear }), -1, false);
  }, []);

  useEffect(() => {
    if (!runTrigger || !isRunning) return;
    setActiveNodes({}); setActivePaths({});
    
    const activeEdges = EDGES.filter((e) => {
      if (e.type === 'both') return true;
      if (urlType === 'standard' && e.type === 'standard') return true;
      if (urlType === 'custom' && e.type === 'custom') return true;
      if (processMode === 'cloud' && e.type === 'cloud') return true;
      if (processMode === 'local' && e.type === 'local') return true;
      return false;
    });

    const sequenceSteps = [
      activeEdges.filter((e) => e.from === 'client' && (e.to === 'cobalt' || e.to === 'ytdlp')),
      activeEdges.filter((e) => (e.from === 'cobalt' || e.from === 'ytdlp') && e.to === 'edge'),
      activeEdges.filter((e) => e.from === 'edge' && e.to === 'stt'),
      activeEdges.filter((e) => e.from === 'stt' && e.to === 'edge'),
      activeEdges.filter((e) => (e.from === 'edge' && e.to === 'gemini') || (e.from === 'edge' && e.to === 'client')),
      activeEdges.filter((e) => (e.from === 'client' && e.to === 'gemma') || (e.from === 'gemini' && e.to === 'db')),
      activeEdges.filter((e) => e.from === 'gemma' && e.to === 'db'),
    ];

    let delay = 0;
    sequenceSteps.forEach((stepEdges) => {
      if (stepEdges.length === 0) return;
      setTimeout(() => {
        stepEdges.forEach((edge) => {
          setActivePaths((prev) => ({ ...prev, [edge.id]: true }));
          setActiveNodes((prev) => ({ ...prev, [edge.from]: true, [edge.to]: true }));
        });
      }, delay);
      delay += 800;
    });
    setTimeout(() => onComplete(), delay + 500);
  }, [runTrigger, isRunning, urlType, processMode]);

  return (
    <View 
      style={styles.simulatorViewport} 
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }}
    >
      {containerSize.width > 0 && (
        <>
          <Svg width={containerSize.width} height={containerSize.height} style={styles.svgOverlay}>
            {EDGES.map((edge) => (
              <PipelineEdge 
                key={edge.id} 
                edge={edge} 
                fromPos={nodePositions[edge.from]} 
                toPos={nodePositions[edge.to]} 
                isActive={activePaths[edge.id]} 
                flowProgress={flowProgress}
              />
            ))}
          </Svg>
          
          {Object.keys(NODE_CONFIG).map((id) => (
            <PipelineNode 
              key={id} 
              node={NODE_CONFIG[id as keyof typeof NODE_CONFIG]} 
              pos={nodePositions[id]}
              isActive={activeNodes[id]} 
              isMobile={isMobile}
            />
          ))}
        </>
      )}
    </View>
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// MODULE 3: UI HELPERS
// ══════════════════════════════════════════════════════════════════════════════

const SegmentControl = memo(({ label, options, selected, onSelect }: any) => (
  <View style={styles.segmentContainer}>
    <Text style={styles.segmentLabel}>{label}</Text>
    <View style={styles.segmentTrack}>
      {options.map((opt: any) => {
        const isActive = selected === opt.value;
        return (
          <TouchableOpacity key={opt.value} style={[styles.segmentBtn, isActive && styles.segmentBtnActive]} onPress={() => onSelect(opt.value)} activeOpacity={0.8}>
            {opt.icon && <opt.icon size={14} color={isActive ? THEME.cyan : THEME.textMuted} style={{ marginRight: 6 }} />}
            <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
));

export default function AboutScreen() {
  const router = useRouter();
  const [urlType, setUrlType] = useState<'standard' | 'custom'>('standard');
  const [processMode, setProcessMode] = useState<'cloud' | 'local'>('cloud');
  const [isRunning, setIsRunning] = useState(false);
  const [runTrigger, setRunTrigger] = useState(0);

  const handleRunSimulation = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    setRunTrigger((prev) => prev + 1);
  }, [isRunning]);

  return (
    <SafeAreaView style={styles.rootContainer} edges={['top', 'bottom']}>
      <AmbientArchitecture />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flexOne}>
        <ScrollView style={styles.flexOne} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.maxLayoutWidth}>
            <View style={styles.navHeader}>
              <TouchableOpacity 
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else router.replace('/settings');
                }}
                activeOpacity={0.7} 
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <ArrowBigLeftDash size={28} color={THEME.cyan} />
              </TouchableOpacity>
              <View style={{ width: 28 }} />
            </View>

            <View style={styles.ledgerWrapper}>
              <AnimatedLedgerIcon />
              <View style={styles.ledgerBar} />
            </View>

            <View style={styles.glassPanel}>
              <View style={styles.panelHeaderRow}>
                <Activity size={18} color={THEME.cyan} />
                <Text style={styles.panelTitle}>VeraxAI Hybrid Intelligence Pipeline Simulator</Text>
              </View>
              <View style={styles.controlsGrid}>
                <SegmentControl label="URL TYPE" selected={urlType} onSelect={setUrlType} options={[{ label: 'Standard URL', value: 'standard', icon: Link2 }, { label: 'Encrypted Proxy', value: 'custom', icon: ShieldAlert }]} />
                <SegmentControl label="PROCESSING ENGINE" selected={processMode} onSelect={setProcessMode} options={[{ label: 'Cloud AI', value: 'cloud', icon: CloudLightning }, { label: 'Local Edge', value: 'local', icon: MonitorSmartphone }]} />
              </View>
              <TouchableOpacity activeOpacity={0.8} style={[styles.runBtn, isRunning && styles.runBtnDisabled]} onPress={handleRunSimulation} disabled={isRunning}>
                <Zap size={20} color={isRunning ? '#FFF' : '#000'} />
                <Text style={[styles.runBtnText, isRunning && { color: '#FFF' }]}>{isRunning ? 'EXECUTING PIPELINE...' : 'RUN SIMULATION'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.simulatorContainer}>
              <PipelineSimulator urlType={urlType} processMode={processMode} runTrigger={runTrigger} isRunning={isRunning} onComplete={() => setIsRunning(false)} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: THEME.obsidian },
  flexOne: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 60, paddingHorizontal: 20, paddingTop: 10 },
  maxLayoutWidth: { maxWidth: 1000, alignSelf: 'center', width: '100%' },
  navHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  ledgerWrapper: { alignItems: 'center', justifyContent: 'center', marginBottom: 30, marginTop: 10 },
  ledgerBar: { backgroundColor: THEME.cyan, height: 4, width: 60, marginTop: 16, borderRadius: 2, shadowColor: THEME.cyan, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 5 },
  glassPanel: { backgroundColor: THEME.glass, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0, 240, 255, 0.15)', padding: 24, marginBottom: 24, overflow: 'hidden', ...(IS_WEB ? ({ backdropFilter: 'blur(20px)' } as any) : {}) },
  panelHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  panelTitle: { color: THEME.textMuted, fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  controlsGrid: { flexDirection: SCREEN_WIDTH > 768 ? 'row' : 'column', gap: 20, marginBottom: 24 },
  segmentContainer: { flex: 1 },
  segmentLabel: { color: THEME.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 },
  segmentTrack: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  segmentBtn: { flex: 1, flexDirection: 'row', paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  segmentBtnActive: { backgroundColor: 'rgba(0, 240, 255, 0.1)', borderWidth: 1, borderColor: 'rgba(0, 240, 255, 0.3)' },
  segmentText: { color: THEME.textMuted, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: THEME.cyan },
  runBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.cyan, padding: 16, borderRadius: 12, gap: 10, shadowColor: THEME.cyan, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 8 },
  runBtnDisabled: { backgroundColor: THEME.nodeBorder, shadowOpacity: 0, elevation: 0 },
  runBtnText: { color: '#000', fontWeight: '900', letterSpacing: 1.5, fontSize: 14 },
  simulatorContainer: { 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    borderRadius: 24, 
    borderWidth: 1, 
    borderColor: THEME.nodeBorder, 
    overflow: 'hidden',
    padding: 10,
    marginBottom: 40
  },
  simulatorViewport: { 
    width: '100%', 
    aspectRatio: SCREEN_WIDTH > 768 ? 16 / 9 : 1 / 2, // Increased height for mobile
    position: 'relative',
  },
  svgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  nodeCard: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  nodeLabel: {
    color: THEME.textMain,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },
  nodeSub: {
    color: THEME.textMuted,
    fontSize: 7,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 1,
  },
});
