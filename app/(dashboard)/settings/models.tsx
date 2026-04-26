import React, { useState, memo, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
  Alert,
  Dimensions,
  StyleSheet,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import Slider from '@react-native-community/slider';
import {
  ArrowBigLeftDash,
  Cpu,
  Trash2,
  Download,
  Play,
  Server,
  Zap,
  Settings2,
  Database,
  Info,
  Sparkles,
  ChevronUp,
  Check,
  Flame,
  ExternalLink,
  HelpCircle,
} from 'lucide-react-native';

import { GlassCard } from '../../../components/ui/GlassCard';
import { FadeIn } from '../../../components/animations/FadeIn';
import { useLocalAIStore } from '../../../store/useLocalAIStore';
import { cn } from '../../../lib/utils';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
} from 'react-native-reanimated';

// --- Constants & Types ---

const IS_WEB = Platform.OS === 'web';
const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

const THEME = {
  obsidian: '#020205',
  cyan: '#00F0FF',
  purple: '#8A2BE2',
  pink: '#FF007F',
  green: '#32FF00',
  red: '#FF3333',
  slate: '#94A3B8',
  amber: '#F59E0B',
  primary: '#6366F1',
} as const;

export interface LocalModel {
  id: string;
  name: string;
  sizeGb: number;
  minRamGb: number;
  isUncensored: boolean;
  tags: string[];
  downloadUrl: string;
  fileName: string;
  architecture: 'gemma4' | 'phi3';
  benchmarks: {
    expectedTokSec: number;
    promptEvalMs: number;
    memoryBandwidth: string;
  };
  description?: string;
}

const AVAILABLE_MODELS: LocalModel[] = [
  {
    id: 'gemma-4-e2b-it',
    name: 'Gemma-4 E2B-it',
    sizeGb: 2.5,
    minRamGb: 4,
    isUncensored: false,
    tags: ['E2B', 'LITERT', 'UNGATED'],
    downloadUrl:
      'https://huggingface.co/litert-community/gemma-4-e2b-it-litertlm/resolve/main/model.litertlm',
    fileName: 'gemma-4-e2b-it.litertlm',
    architecture: 'gemma4',
    benchmarks: {
      expectedTokSec: 32.5,
      promptEvalMs: 120,
      memoryBandwidth: 'Low',
    },
    description: 'Optimized for speed and low-latency tasks. Best for simple extraction and short-form Q&A.',
  },
  {
    id: 'gemma-4-e4b-it',
    name: 'Gemma-4 E4B-it',
    sizeGb: 3.6,
    minRamGb: 8,
    isUncensored: false,
    tags: ['E4B', 'LITERT', 'REASONING'],
    downloadUrl:
      'https://huggingface.co/litert-community/gemma-4-e4b-it-litertlm/resolve/main/model.litertlm',
    fileName: 'gemma-4-e4b-it.litertlm',
    architecture: 'gemma4',
    benchmarks: {
      expectedTokSec: 18.2,
      promptEvalMs: 380,
      memoryBandwidth: 'Medium',
    },
    description: 'Superior reasoning and multi-step logic. Best for complex data extraction and long context.',
  },
];

// --- Sub-components ---

interface OrganicOrbProps {
  color: string;
  size: number;
  initialX: number;
  initialY: number;
  speedX: number;
  speedY: number;
  phaseOffsetX: number;
  phaseOffsetY: number;
  opacityBase: number;
}

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
  }: OrganicOrbProps) => {
    const time = useSharedValue(0);

    useFrameCallback((frameInfo) => {
      if (frameInfo.timeSincePreviousFrame === null) return;
      time.value += frameInfo.timeSincePreviousFrame / 1000;
    });

    const animatedStyle = useAnimatedStyle(() => {
      const xOffset =
        Math.sin(time.value * speedX + phaseOffsetX) * (WINDOW_WIDTH * 0.3);
      const yOffset =
        Math.cos(time.value * speedY + phaseOffsetY) * (WINDOW_HEIGHT * 0.2);
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
            ...(IS_WEB ? ({ filter: 'blur(80px)' } as any) : {}),
          },
          animatedStyle,
        ]}
      />
    );
  },
);
OrganicOrb.displayName = 'OrganicOrb';

const AmbientArchitecture = memo(() => (
  <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none">
    <OrganicOrb
      color={THEME.purple}
      size={WINDOW_WIDTH * 0.7}
      initialX={WINDOW_WIDTH * 0.8}
      initialY={WINDOW_HEIGHT * 0.6}
      speedX={0.12}
      speedY={0.18}
      phaseOffsetX={Math.PI}
      phaseOffsetY={0}
      opacityBase={0.05}
    />
    <OrganicOrb
      color={THEME.cyan}
      size={WINDOW_WIDTH * 0.5}
      initialX={WINDOW_WIDTH * 0.2}
      initialY={WINDOW_HEIGHT * 0.3}
      speedX={0.2}
      speedY={0.1}
      phaseOffsetX={Math.PI / 4}
      phaseOffsetY={Math.PI}
      opacityBase={0.04}
    />
  </View>
));
AmbientArchitecture.displayName = 'AmbientArchitecture';

const Tag = memo(({ tag }: { tag: string }) => {
  const style = useMemo(() => {
    switch (tag) {
      case 'E2B':
        return {
          bg: 'bg-[#00F0FF]/20',
          border: 'border-[#00F0FF]/40',
          text: 'text-[#00F0FF]',
        };
      case 'UNGATED':
        return {
          bg: 'bg-[#8A2BE2]/20',
          border: 'border-[#8A2BE2]/40',
          text: 'text-[#C496FC]',
        };
      case 'LITERT':
        return {
          bg: 'bg-[#32FF00]/20',
          border: 'border-[#32FF00]/40',
          text: 'text-[#32FF00]',
        };
      case 'E4B':
      case 'REASONING':
        return {
          bg: 'bg-[#F59E0B]/20',
          border: 'border-[#F59E0B]/40',
          text: 'text-[#F59E0B]',
        };
      default:
        return {
          bg: 'bg-white/5',
          border: 'border-white/10',
          text: 'text-white/60',
        };
    }
  }, [tag]);

  return (
    <View
      className={cn('px-2 py-1 border rounded', style.bg, style.border)}
    >
      <Text
        className={cn(
          'text-[8px] font-black uppercase tracking-[1px]',
          style.text,
        )}
      >
        {tag}
      </Text>
    </View>
  );
});
Tag.displayName = 'Tag';

interface ModelCardProps {
  model: LocalModel;
  isActive: boolean;
  downloaded: boolean;
  isDownloading: boolean;
  progress: number;
  onLoad: (id: string) => void;
  onDownload: (model: LocalModel) => void;
  onRemove: (model: LocalModel) => void;
}

const ModelCard = memo(
  ({
    model,
    isActive,
    downloaded,
    isDownloading,
    progress,
    onLoad,
    onDownload,
    onRemove,
  }: ModelCardProps) => (
    <GlassCard
      className={cn(
        'p-4 md:p-5 rounded-3xl border',
        isActive
          ? 'border-[#32FF00]/30 bg-[#32FF00]/5'
          : 'border-white/5 bg-white/[0.015]',
      )}
    >
      <View className="flex-row flex-wrap items-center gap-2 mb-3">
        {model.tags.map((tag) => (
          <Tag key={tag} tag={tag} />
        ))}
        {isActive && (
          <View className="px-2 py-1 rounded bg-[#32FF00]/20 border border-[#32FF00]/30 ml-auto">
            <Text className="text-[8px] font-black text-[#32FF00] uppercase tracking-[1px]">
              Online
            </Text>
          </View>
        )}
      </View>

      <Text className="mb-2 text-sm font-bold tracking-widest text-white">
        {model.name}
      </Text>
      
      {model.description && (
        <Text className="mb-4 text-[11px] text-white/50 leading-4">
          {model.description}
        </Text>
      )}

      <View className="flex-row flex-wrap items-center gap-4 pb-4 mb-6 border-b gap-y-3 border-white/5">
        <View className="flex-row items-center gap-1">
          <Database size={12} color={THEME.slate} />
          <Text className="text-[10px] font-mono text-white/50">
            {model.sizeGb} GB
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Cpu size={12} color={THEME.slate} />
          <Text className="text-[10px] font-mono text-white/50">
            Min {model.minRamGb}GB
          </Text>
        </View>
        <View className="flex-row items-center gap-1 ml-auto">
          <Zap size={12} color={THEME.amber} />
          <Text className="text-[10px] font-mono text-amber-400/80">
            ~{model.benchmarks.expectedTokSec} t/s
          </Text>
        </View>
      </View>

      {downloaded ? (
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => onLoad(model.id)}
            disabled={isActive}
            activeOpacity={0.7}
            style={{ flex: 1 }} // Ensure explicit width for web responder
            className={cn(
              'h-12 flex-row items-center justify-center rounded-xl border',
              isActive
                ? 'bg-[#32FF00]/10 border-[#32FF00]/30'
                : 'bg-[#00F0FF]/10 border-[#00F0FF]/30',
            )}
          >
            <Play
              size={14}
              color={isActive ? THEME.green : THEME.cyan}
              className="mr-2"
            />
            <Text
              className={cn(
                'text-[10px] font-black tracking-[2px] uppercase shrink-0',
                isActive ? 'text-[#32FF00]' : 'text-[#00F0FF]',
              )}
            >
              {isActive ? 'Engine Active' : 'Load Model'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onRemove(model)}
            activeOpacity={0.7}
            style={{ width: 48 }} // Explicit width
            className="items-center justify-center h-12 border rounded-xl bg-rose-500/10 border-rose-500/20"
          >
            <Trash2 size={16} color={THEME.red} />
          </TouchableOpacity>
        </View>
      ) : isDownloading ? (
        <View className="relative justify-center w-full h-12 overflow-hidden border rounded-xl bg-white/5 border-[#00F0FF]/30">
          <View
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              backgroundColor: 'rgba(0, 240, 255, 0.2)',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
          <Text className="text-center text-[10px] md:text-[11px] font-black text-[#00F0FF] uppercase tracking-[2px]">
            {IS_WEB ? 'Configuring Gateway...' : 'Downloading Binary...'} {Math.round(progress * 100)}%
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => onDownload(model)}
          activeOpacity={0.7}
          style={{ width: '100%' }} // Explicit width
          className="flex-row items-center justify-center h-12 border rounded-xl bg-white/5 border-white/10"
        >
          <Download size={14} color="white" className="mr-2" />
          <Text className="text-[10px] font-black text-white uppercase tracking-[2px] shrink-0">
            {IS_WEB ? 'Configure Endpoint' : 'Download Vector Binary'}
          </Text>
        </TouchableOpacity>
      )}
    </GlassCard>
  ),
);
ModelCard.displayName = 'ModelCard';

interface HardwareSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  icon?: React.ReactNode;
  unit?: string;
  showInput?: boolean;
}

const HardwareSlider = memo(
  ({
    label,
    value,
    min,
    max,
    step,
    onChange,
    icon,
    unit,
    showInput = true,
  }: HardwareSliderProps) => (
    <View className="mb-6">
      <Text className="mb-3 text-[14px] text-white/90">{label}</Text>
      <View className="flex-row items-center justify-between">
        {icon ? icon : <Text className="w-8 text-sm text-white/60">{min}</Text>}
        <View className="justify-center flex-1 mx-4">
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={min}
            maximumValue={max}
            step={step}
            value={value}
            onValueChange={onChange}
            minimumTrackTintColor={THEME.primary}
            maximumTrackTintColor="#ffffff30"
            thumbTintColor={THEME.primary}
          />
        </View>
        {showInput ? (
          <TextInput
            value={String(value)}
            onChangeText={(txt) => onChange(Number(txt) || min)}
            keyboardType="number-pad"
            className="w-16 p-2 text-sm text-center text-white border rounded-lg bg-white/5 border-white/20"
            style={IS_WEB ? ({ outlineStyle: 'none' } as any) : {}}
          />
        ) : (
          <Text className="w-8 text-sm font-bold text-right text-white">
            {value}
            {unit}
          </Text>
        )}
      </View>
    </View>
  ),
);
HardwareSlider.displayName = 'HardwareSlider';

// --- Main Screen ---

export default function LocalModelsScreen() {
  const router = useRouter();
  const isMobile = WINDOW_WIDTH < 768;

  const {
    isLocalServerEnabled,
    toggleServer,
    port,
    setPort,
    computeBackend,
    setComputeBackend,
    gpuLayers,
    temperature,
    setHardwareState,
    activeModelId,
    setActiveModel,
    downloadedModels,
    downloadProgress,
    setDownloadProgress,
    markDownloaded,
    removeModel,
    clearDownloadProgress,
  } = useLocalAIStore();

  const [activeTab, setActiveTab] = useState<'models' | 'hardware'>('models');
  const [modelFilter, setModelFilter] = useState<'catalog' | 'device'>(
    'catalog',
  );
  const [prefillTokens, setPrefillTokens] = useState<number>(256);
  const [decodeTokens, setDecodeTokens] = useState<number>(256);
  const [accelerator, setAccelerator] = useState<'GPU' | 'CPU'>('GPU');
  const [deviceStats, setDeviceStats] = useState<{
    cores: number;
    ramGb: number;
  }>({ cores: 8, ramGb: 8 });

  // Hardware detection
  useEffect(() => {
    const fetchNativeHardware = async () => {
      if (IS_WEB) {
        setDeviceStats({
          cores: navigator.hardwareConcurrency || 8,
          ramGb: 16,
        });
      } else {
        try {
          const DeviceInfo = require('react-native-device-info');
          const totalMemoryBytes = await DeviceInfo.getTotalMemory();
          const ramGb = Math.round(totalMemoryBytes / (1024 * 1024 * 1024));
          setDeviceStats({ cores: 8, ramGb });
        } catch (e) {
          console.error('Hardware detection failed:', e);
          setDeviceStats({ cores: 8, ramGb: 6 });
        }
      }
    };
    fetchNativeHardware();
  }, []);

  const handleDownload = useCallback(
    async (model: LocalModel) => {
      if (IS_WEB) {
        setDownloadProgress(model.id, 0.05);
        setTimeout(() => {
          markDownloaded(model.id, `edge_routed://${model.id}`);
          setActiveModel(model.id);
          setDownloadProgress(model.id, 1);
        }, 800);
        return;
      }

      try {
        const docDir = FileSystem.documentDirectory || 'file:///tmp/';
        const fileUri = `${docDir}${model.fileName}`;

        const downloadResumable = FileSystem.createDownloadResumable(
          model.downloadUrl,
          fileUri,
          {},
          (progressData: any) => {
            setDownloadProgress(
              model.id,
              progressData.totalBytesWritten /
                progressData.totalBytesExpectedToWrite,
            );
          },
        );

        setDownloadProgress(model.id, 0.01);
        const result = await downloadResumable.downloadAsync();

        if (result && result.uri) {
          markDownloaded(model.id, result.uri);
          setActiveModel(model.id);
        }
      } catch (e: any) {
        Alert.alert(
          'Download Interrupted',
          e.message ||
            'Ensure you have sufficient device storage and a stable connection.',
        );
        clearDownloadProgress(model.id);
      }
    },
    [
      setDownloadProgress,
      markDownloaded,
      setActiveModel,
      clearDownloadProgress,
    ],
  );

  const handleRemove = useCallback(
    async (model: LocalModel) => {
      if (!IS_WEB) {
        const docDir = FileSystem.documentDirectory || 'file:///tmp/';
        const fileUri = `${docDir}${model.fileName}`;
        try {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        } catch (e) {
          console.warn('Failed to delete model file:', e);
        }
      }
      removeModel(model.id);
    },
    [removeModel],
  );

  const handleLoadModel = useCallback(
    (id: string) => {
      setActiveModel(id);
      if (IS_WEB) {
        const model = AVAILABLE_MODELS.find((m) => m.id === id);
        Alert.alert(
          'Endpoint Configured',
          `Inference actively routing to ${model?.name || id} via local gateway. Ensure Ollama or LM Studio is running on port ${port}.`,
        );
      }
    },
    [setActiveModel, port],
  );

  const handleReturn = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(dashboard)');
  }, [router]);

  const isModelDownloaded = useCallback(
    (modelId: string) =>
      Array.isArray(downloadedModels) ? downloadedModels.includes(modelId) : false,
    [downloadedModels],
  );

  const displayedModels = useMemo(
    () =>
      AVAILABLE_MODELS.filter((m) =>
        modelFilter === 'catalog' ? true : isModelDownloaded(m.id),
      ),
    [modelFilter, isModelDownloaded],
  );

  const renderModelsTab = () => (
    <FadeIn delay={100} className="w-full">
      {IS_WEB && (
        <GlassCard className="p-4 mb-6 border-cyan/20 bg-cyan/5">
          <View className="flex-row items-center gap-3 mb-2">
            <Info size={18} color={THEME.cyan} />
            <Text className="text-xs font-bold tracking-widest text-white uppercase">Web Platform Notice</Text>
          </View>
          <Text className="text-[11px] text-white/60 leading-5">
            You are running the Web version on a desktop browser. Direct binary execution is restricted. 
            To use local models, run <Text className="font-bold text-cyan">Ollama</Text> or <Text className="font-bold text-cyan">LM Studio</Text> on your machine and configure the port in the Hardware tab.
          </Text>
        </GlassCard>
      )}

      <View className="flex-row flex-wrap gap-3 mb-6">
        {(['catalog', 'device'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            onPress={() => setModelFilter(filter)}
            className={cn(
              'px-5 py-2.5 rounded-full border',
              modelFilter === filter
                ? 'bg-[#8A2BE2]/20 border-[#8A2BE2]/50'
                : 'bg-transparent border-white/10',
            )}
          >
            <Text
              className={cn(
                'text-[10px] font-black tracking-[2px] uppercase',
                modelFilter === filter ? 'text-[#8A2BE2]' : 'text-white/40',
              )}
            >
              {filter === 'catalog'
                ? 'Catalog'
                : IS_WEB
                  ? 'Configured Endpoints'
                  : 'Device Storage'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="gap-y-4">
        {displayedModels.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            isActive={activeModelId === model.id}
            downloaded={isModelDownloaded(model.id)}
            isDownloading={
              downloadProgress[model.id] !== undefined &&
              downloadProgress[model.id] < 1
            }
            progress={downloadProgress[model.id] || 0}
            onLoad={handleLoadModel}
            onDownload={handleDownload}
            onRemove={handleRemove}
          />
        ))}
      </View>

      <GlassCard className="p-5 mt-8 border-white/5 bg-white/[0.01]">
        <View className="flex-row items-center gap-2 mb-4">
          <HelpCircle size={18} color={THEME.purple} />
          <Text className="text-xs font-bold tracking-widest text-white uppercase">Gemma E2B vs E4B</Text>
        </View>
        
        <View className="gap-y-4">
          <View>
            <Text className="text-[10px] font-black text-cyan uppercase mb-1">E2B (2 Billion Parameters)</Text>
            <Text className="text-[11px] text-white/50 leading-4">
              Optimized for speed (20-35 t/s). Best for simple extraction, short-form Q&A, and devices with 4-6GB RAM.
            </Text>
          </View>
          <View>
            <Text className="text-[10px] font-black text-purple uppercase mb-1">E4B (4 Billion Parameters)</Text>
            <Text className="text-[11px] text-white/50 leading-4">
              Superior reasoning and multi-step logic. Measurably better at complex data extraction and long context. Requires 8GB+ RAM.
            </Text>
          </View>
        </View>
      </GlassCard>
    </FadeIn>
  );

  const renderHardwareTab = () => {
    const backendLabel =
      computeBackend === 'auto'
        ? 'Auto'
        : computeBackend === 'opencl'
          ? 'OpenCL'
          : computeBackend === 'vulkan'
            ? 'Vulkan'
            : computeBackend === 'metal'
              ? 'Metal'
              : 'CPU Only';

    const safeTemp = temperature ?? 0.7;
    const safeLayers = gpuLayers ?? 33;

    return (
      <FadeIn delay={100} className="w-full pb-20 gap-y-6">
        <View className="mb-4">
          <Text className="mb-3 text-[14px] text-white/90">Accelerator</Text>
          <View className="flex-row w-48 overflow-hidden border rounded-full border-white/20">
            {(['GPU', 'CPU'] as const).map((type) => (
              <React.Fragment key={type}>
                <TouchableOpacity
                  onPress={() => {
                    setAccelerator(type);
                    if (type === 'GPU') {
                      if (IS_WEB) {
                        setComputeBackend('auto');
                      } else {
                        setComputeBackend(
                          deviceStats.ramGb >= 8 ? 'opencl' : 'vulkan',
                        );
                      }
                    } else {
                      setComputeBackend('cpu');
                      setHardwareState('gpuLayers', 0);
                    }
                  }}
                  className={cn(
                    'flex-1 py-2 items-center flex-row justify-center',
                    accelerator === type ? 'bg-[#005c99]' : 'bg-transparent',
                  )}
                >
                  {accelerator === type && (
                    <Check size={14} color="white" className="mr-2" />
                  )}
                  <Text className="text-sm font-medium text-white">{type}</Text>
                </TouchableOpacity>
                {type === 'GPU' && <View className="w-px h-full bg-white/20" />}
              </React.Fragment>
            ))}
          </View>
        </View>

        <HardwareSlider
          label="Prefill tokens"
          value={prefillTokens}
          min={16}
          max={4000}
          step={1}
          onChange={(val) => {
            const num = Math.round(val);
            setPrefillTokens(num);
            setHardwareState('prefillTokens' as any, num);
          }}
        />

        <HardwareSlider
          label="Decode tokens"
          value={decodeTokens}
          min={16}
          max={4000}
          step={1}
          onChange={(val) => {
            const num = Math.round(val);
            setDecodeTokens(num);
            setHardwareState('decodeTokens' as any, num);
          }}
        />

        <HardwareSlider
          label="Temperature"
          value={safeTemp}
          min={0.1}
          max={1.0}
          step={0.1}
          onChange={(val) =>
            setHardwareState('temperature', parseFloat(val.toFixed(1)))
          }
          icon={<Flame size={18} color="#94A3B8" className="mr-2" />}
          showInput={false}
          unit=""
        />

        <GlassCard className="p-5 border-white/10 bg-[#12121A]/80 rounded-[28px] shadow-2xl mb-8">
          <View className="flex-row items-center gap-2 mb-1.5">
            <Sparkles size={18} color={THEME.primary} />
            <Text className="text-[15px] font-bold tracking-wide text-white">
              Compute Device
            </Text>
          </View>
          <Text className="mb-5 text-xs text-white/50 ml-7">
            Current:{' '}
            {accelerator === 'CPU' ? 'CPU Only' : `GPU (${backendLabel})`} •{' '}
            {safeLayers} layers
          </Text>

          <TouchableOpacity
            onPress={() => {
              if (IS_WEB) {
                setAccelerator('GPU');
                setComputeBackend('auto');
                setHardwareState('gpuLayers', 33);
                Alert.alert(
                  'Optimization Applied',
                  'WebGPU/WASM acceleration enabled for browser inference.',
                );
              } else {
                const recommendedBackend =
                  deviceStats.ramGb >= 8 ? 'opencl' : 'vulkan';
                setAccelerator('GPU');
                setComputeBackend(recommendedBackend as any);
                setHardwareState('gpuLayers', deviceStats.ramGb >= 8 ? 33 : 15);
                Alert.alert(
                  'Optimization Applied',
                  `${recommendedBackend.toUpperCase()} GPU mapped to ${deviceStats.cores} cores.`,
                );
              }
            }}
            activeOpacity={0.8}
            className="flex-row items-center justify-center w-full py-3.5 mb-4 rounded-xl bg-[#6366F1] shadow-[0_0_20px_rgba(99,102,241,0.3)]"
          >
            <Settings2 size={16} color="white" className="mr-2" />
            <Text className="text-sm font-bold tracking-wide text-white">
              Apply Recommended Settings
            </Text>
          </TouchableOpacity>

          <View className="flex-row items-center px-4 py-3 mb-6 border rounded-xl bg-[#1a1a2e]/50 border-[#6366F1]/20">
            <Info size={14} color={THEME.primary} className="mr-3 shrink-0" />
            <Text className="text-[11px] font-medium leading-5 text-[#94A3B8]">
              {IS_WEB 
                ? "Web Platform: Inference is routed via local HTTP gateway (Ollama/LM Studio). Hardware settings here affect the local runner's configuration if supported."
                : computeBackend === 'opencl'
                  ? `OpenCL GPU — best for high-end SoC (${deviceStats.cores} cores detected)`
                  : computeBackend === 'vulkan'
                    ? `Vulkan GPU — optimal for mid-range SoC (${deviceStats.cores} cores detected)`
                    : `CPU Fallback — stable but slow. Reduce GPU layers to prevent crashes.`}
            </Text>
          </View>

          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xs font-bold text-white/80">
              Manual Override
            </Text>
            <ChevronUp size={16} color={THEME.slate} />
          </View>

          <View className="flex-row gap-2 mb-8">
            {(['cpu', 'vulkan', 'opencl', 'metal'] as const).map((backend) => (
              <TouchableOpacity
                key={backend}
                onPress={() => {
                  setComputeBackend(backend);
                  if (backend === 'cpu') {
                    setAccelerator('CPU');
                    setHardwareState('gpuLayers', 0);
                  } else setAccelerator('GPU');
                }}
                className={cn(
                  'flex-1 py-3.5 items-center rounded-xl border transition-all',
                  computeBackend === backend
                    ? 'bg-[#6366F1] border-[#6366F1]'
                    : 'bg-[#1a1a2e] border-transparent',
                )}
              >
                <Text
                  className={cn(
                    'text-xs font-bold tracking-wide',
                    computeBackend === backend ? 'text-white' : 'text-white/50',
                  )}
                >
                  {backend.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-sm font-medium text-white/90">
              GPU Layers
            </Text>
            <View className="px-3 py-1.5 border rounded-lg bg-black/40 border-white/5">
              <Text className="text-xs font-bold text-white">{safeLayers}</Text>
            </View>
          </View>

          <View className="justify-center flex-1 mx-2 mb-6">
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={0}
              maximumValue={99}
              step={1}
              value={safeLayers}
              onValueChange={(val) =>
                setHardwareState('gpuLayers', Math.round(val))
              }
              minimumTrackTintColor={THEME.primary}
              maximumTrackTintColor="#ffffff30"
              thumbTintColor={THEME.primary}
              disabled={accelerator === 'CPU'}
            />
          </View>
        </GlassCard>

        <View className="mb-10">
          <Text className="mb-2 text-[13px] font-bold text-white/90 ml-1 tracking-wide">
            Local API Server
          </Text>
          <Text className="text-[11px] text-[#94A3B8] mb-4 ml-1">
            {IS_WEB 
              ? "Configure the port for your local inference gateway (Ollama/LM Studio)."
              : "Expose the loaded model to OpenAI-compatible local clients."}
          </Text>

          <GlassCard className="p-5 border-white/5 bg-[#12121A]/80 rounded-[24px]">
            <View className="flex-row items-center justify-between mb-5">
              <View className="flex-row items-center flex-1 gap-4 pr-4">
                <View className="p-2.5 bg-[#1a1a2e] rounded-xl">
                  <Server size={18} color="#94A3B8" />
                </View>
                <View className="flex-1 shrink">
                  <Text className="text-sm font-bold tracking-wide text-white">
                    {IS_WEB ? "Gateway Endpoint" : "API Gateway Link"}
                  </Text>
                  <Text className="text-[10px] text-white/40 mt-1 font-mono">
                    http://127.0.0.1:{port}/v1
                  </Text>
                </View>
              </View>
              <Switch
                value={isLocalServerEnabled}
                onValueChange={toggleServer}
                trackColor={{ false: '#3F3F46', true: THEME.primary }}
                thumbColor={'#ffffff'}
              />
            </View>

            <View className="flex-row items-center px-4 overflow-hidden border h-11 bg-black/60 border-white/10 rounded-xl">
              <Text className="mr-3 text-xs font-bold text-white/50">PORT</Text>
              <TextInput
                value={port}
                onChangeText={setPort}
                keyboardType="number-pad"
                className="flex-1 font-mono text-sm text-white"
                editable={!isLocalServerEnabled}
                style={IS_WEB ? ({ outlineStyle: 'none' } as any) : {}}
              />
            </View>
            
            {IS_WEB && (
              <TouchableOpacity 
                onPress={() => Linking.openURL('https://ollama.com/')}
                className="flex-row items-center justify-center gap-2 mt-4"
              >
                <Text className="text-[10px] font-black tracking-[4px] text-[#00F0FF] uppercase">GET OLLAMA</Text>
                <ExternalLink size={10} color={THEME.cyan} />
              </TouchableOpacity>
            )}
          </GlassCard>
        </View>
      </FadeIn>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: THEME.obsidian }}>
      <AmbientArchitecture />
      <SafeAreaView style={{ flex: 1, zIndex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View className="z-50 flex-row items-center justify-between w-full max-w-3xl px-4 pt-4 mx-auto md:px-8">
            <TouchableOpacity
              onPress={handleReturn}
              className="flex-row items-center gap-2 p-2 md:p-4"
              activeOpacity={0.7}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <ArrowBigLeftDash size={20} color={THEME.cyan} />
              <Text className="text-[10px] font-black tracking-[4px] text-[#00F0FF] uppercase hidden md:flex">
                RETURN
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            // FIX: keyboardShouldPersistTaps="handled" prevents ScrollView from 
            // aggressively hijacking touches intended for children (Sliders/Buttons)
            keyboardShouldPersistTaps="handled"
            // FIX: On Web, prevent the ScrollView from becoming a responder when 
            // interacting with sliders by using scrollEnabled logic if needed, 
            // but primarily handled via persistTaps.
            contentContainerStyle={{
              flexGrow: 1,
              maxWidth: 800,
              alignSelf: 'center',
              width: '100%',
              paddingHorizontal: isMobile ? 16 : 40,
              paddingBottom: 150,
            }}
          >
            <View
              className="flex-row w-full mt-2 mb-8 border-b md:mt-4 border-white/10"
              style={{ zIndex: 10 }}
            >
              {(['models', 'hardware'] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.7}
                  className={cn(
                    'flex-1 items-center pb-4 border-b-2',
                    activeTab === tab
                      ? 'border-[#00F0FF]'
                      : 'border-transparent',
                  )}
                >
                  {tab === 'models' ? (
                    <Database
                      size={16}
                      color={activeTab === tab ? THEME.cyan : THEME.slate}
                      className="mb-2"
                    />
                  ) : (
                    <Settings2
                      size={16}
                      color={activeTab === tab ? THEME.cyan : THEME.slate}
                      className="mb-2"
                    />
                  )}
                  <Text
                    className={cn(
                      'text-[9px] font-black uppercase tracking-[2px]',
                      activeTab === tab ? 'text-[#00F0FF]' : 'text-slate-500',
                    )}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {activeTab === 'models' ? renderModelsTab() : renderHardwareTab()}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
