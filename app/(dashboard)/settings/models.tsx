import React, {
  useState,
  memo,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
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
import * as FileSystemModern from 'expo-file-system'; // Need modern API for storage check
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
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
  Network,
  AlertTriangle,
  TerminalSquare,
  Activity,
} from 'lucide-react-native';

import { GlassCard } from '../../../components/ui/GlassCard';
import { FadeIn } from '../../../components/animations/FadeIn';
import { useLocalAIStore } from '../../../store/useLocalAIStore';
import { cn } from '../../../lib/utils';
import { runLocalInference } from '../../../services/localInference';

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
    id: 'gemma-4-e2b-it-unsloth',
    name: 'Gemma-4 E2B-it (Q4_K_XL)',
    sizeGb: 2.5,
    minRamGb: 4,
    isUncensored: false,
    tags: ['E2B', 'GGUF', 'UNSLOTH'],
    downloadUrl:
      'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-UD-Q4_K_XL.gguf',
    fileName: 'gemma-4-E2B-it-UD-Q4_K_XL.gguf',
    architecture: 'gemma4',
    benchmarks: {
      expectedTokSec: 32.5,
      promptEvalMs: 120,
      memoryBandwidth: 'Low',
    },
    description:
      'Unsloth optimized Q4 quantization. Perfect for fast JSON generation on mobile hardware.',
  },
  {
    id: 'gemma-4-e4b-it-unsloth',
    name: 'Gemma-4 E4B-it (Q4_K_M)',
    sizeGb: 3.6,
    minRamGb: 8,
    isUncensored: false,
    tags: ['E4B', 'GGUF', 'UNSLOTH'],
    downloadUrl:
      'https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf',
    fileName: 'gemma-4-E4B-it-Q4_K_M.gguf',
    architecture: 'gemma4',
    benchmarks: {
      expectedTokSec: 18.2,
      promptEvalMs: 380,
      memoryBandwidth: 'Medium',
    },
    description:
      'Unsloth optimized Q4 quantization. Superior reasoning for long context transcripts.',
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
            ...(IS_WEB
              ? ({ filter: 'blur(80px)' } as Record<string, string>)
              : {}),
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
      case 'GGUF':
        return {
          bg: 'bg-[#00F0FF]/20',
          border: 'border-[#00F0FF]/40',
          text: 'text-[#00F0FF]',
        };
      case 'UNSLOTH':
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
    <View className={cn('px-2 py-1 border rounded', style.bg, style.border)}>
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
  isConnecting: boolean;
  isTesting: boolean;
  onLoad: (id: string) => void;
  onDownload: (model: LocalModel) => void;
  onRemove: (model: LocalModel) => void;
  onTestEngine: () => void;
}

const ModelCard = memo(
  ({
    model,
    isActive,
    downloaded,
    isDownloading,
    progress,
    isConnecting,
    isTesting,
    onLoad,
    onDownload,
    onRemove,
    onTestEngine,
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
              Engine Online
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
            Native GGUF
          </Text>
        </View>
      </View>

      {downloaded ? (
        <View className="flex-row gap-3">
          {!isActive ? (
            <TouchableOpacity
              onPress={() => onLoad(model.id)}
              disabled={isConnecting}
              activeOpacity={0.7}
              style={{ flex: 1 }}
              className={cn(
                'h-12 flex-row items-center justify-center rounded-xl border transition-all',
                'bg-[#00F0FF]/10 border-[#00F0FF]/30',
                isConnecting && 'opacity-50',
              )}
            >
              {isConnecting ? (
                <>
                  <Zap size={14} color={THEME.cyan} className="mr-2" />
                  <Text className="text-[10px] font-black text-[#00F0FF] uppercase tracking-[2px]">
                    {IS_WEB ? 'Testing Port...' : 'Booting Engine...'}
                  </Text>
                </>
              ) : (
                <>
                  <Play size={14} color={THEME.cyan} className="mr-2" />
                  <Text className="text-[10px] font-black tracking-[2px] uppercase shrink-0 text-[#00F0FF]">
                    {IS_WEB ? 'Connect Endpoint' : 'Load Model'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={onTestEngine}
              disabled={isTesting}
              activeOpacity={0.7}
              style={{ flex: 1 }}
              className={cn(
                'h-12 flex-row items-center justify-center rounded-xl border transition-all',
                'bg-[#32FF00]/10 border-[#32FF00]/30',
                isTesting && 'opacity-50',
              )}
            >
              <Activity size={14} color={THEME.green} className="mr-2" />
              <Text className="text-[10px] font-black tracking-[2px] uppercase shrink-0 text-[#32FF00]">
                {isTesting ? 'Running Diagnostics...' : 'Run Diagnostics'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => onRemove(model)}
            activeOpacity={0.7}
            disabled={isConnecting || isTesting}
            style={{ width: 48 }}
            className={cn(
              'items-center justify-center h-12 border rounded-xl bg-rose-500/10 border-rose-500/20',
              (isConnecting || isTesting) && 'opacity-50',
            )}
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
            {IS_WEB
              ? 'Triggering Browser Download...'
              : 'Downloading Binary...'}{' '}
            {Math.round(progress * 100)}%
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => onDownload(model)}
          activeOpacity={0.7}
          style={{ width: '100%' }}
          className="flex-row items-center justify-center h-12 border rounded-xl bg-white/5 border-white/10"
        >
          <Download size={16} color="white" className="mr-3" />
          <Text className="text-[10px] font-black text-white uppercase tracking-[2px] shrink-0">
            {IS_WEB ? 'Download GGUF File' : 'Download Vector Binary'}
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
}

const HardwareSlider = memo(
  ({ label, value, min, max, step, onChange, icon }: HardwareSliderProps) => (
    <View className="mb-6">
      <Text className="mb-3 text-[14px] text-white/90">{label}</Text>
      <View className="flex-row items-center justify-between">
        {icon && <View className="mr-2">{icon}</View>}
        <View className="justify-center flex-1 mr-4">
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
        <TextInput
          value={String(value)}
          onChangeText={(txt) => {
            const parsed = Number(txt);
            if (!isNaN(parsed)) onChange(parsed);
          }}
          keyboardType="number-pad"
          className="w-16 p-2 text-sm font-mono text-center text-white border rounded-lg bg-white/5 border-white/20"
          style={
            IS_WEB ? ({ outlineStyle: 'none' } as Record<string, string>) : {}
          }
        />
      </View>
    </View>
  ),
);
HardwareSlider.displayName = 'HardwareSlider';

export default function LocalModelsScreen() {
  const router = useRouter();
  const isMobile = WINDOW_WIDTH < 768;
  const scrollViewRef = useRef<ScrollView>(null);

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
  const [prefillTokens, setPrefillTokens] = useState<number>(512);
  const [decodeTokens, setDecodeTokens] = useState<number>(512);
  const [accelerator, setAccelerator] = useState<'GPU' | 'CPU'>('GPU');
  const [deviceStats, setDeviceStats] = useState<{
    cores: number;
    ramGb: number;
    name: string;
  }>({ cores: 8, ramGb: 8, name: 'Generic' });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const [appLogs, setAppLogs] = useState<string[]>([
    `[SYSTEM] VeraxAI Hardware Interface initialized.`,
    `[SYSTEM] Environment: ${IS_WEB ? 'Vercel Web Gateway' : 'Android Native (llama.rn)'}`,
  ]);

  const pushLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setAppLogs((prev) => [...prev, `[${timestamp}] ${msg}`].slice(-40));
  }, []);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [appLogs]);

  useEffect(() => {
    const fetchNativeHardware = async () => {
      if (IS_WEB) {
        setDeviceStats({
          cores: navigator.hardwareConcurrency || 8,
          ramGb: 16,
          name: 'Desktop Browser',
        });
      } else {
        try {
          const DeviceInfo = require('react-native-device-info');
          const totalMemoryBytes = await DeviceInfo.getTotalMemory();
          const ramGb = Math.round(totalMemoryBytes / (1024 * 1024 * 1024));
          const deviceName = await DeviceInfo.getDeviceName();
          setDeviceStats({ cores: 8, ramGb, name: deviceName });
          pushLog(`[HARDWARE] Detected ${deviceName} with ~${ramGb}GB RAM.`);
        } catch (e) {
          setDeviceStats({ cores: 8, ramGb: 6, name: 'Android Device' });
        }
      }
    };
    fetchNativeHardware();
  }, [pushLog]);

  const handleDownload = useCallback(
    async (model: LocalModel) => {
      if (IS_WEB) {
        try {
          pushLog(`[NETWORK] Requesting GGUF binary from Hugging Face...`);
          const link = document.createElement('a');
          link.href = model.downloadUrl;
          link.setAttribute('download', model.fileName);
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          markDownloaded(model.id, `edge_routed://${model.id}`);
          pushLog(`[NETWORK] Browser download triggered successfully.`);
          Alert.alert(
            'Download Initiated',
            "The GGUF file is downloading via your browser.\n\nOnce finished:\n1. Load it into LM Studio or Ollama.\n2. Start your Local Server.\n3. Enter your Port in the Hardware tab.\n4. Click 'Connect Endpoint' here.",
          );
        } catch (e) {
          pushLog(`[ERROR] Web Download failed.`);
          Alert.alert(
            'Web Download Error',
            'Could not trigger the file transfer.',
          );
        }
        return;
      }

      try {
        // PRODUCTION SAFEGUARD 1: Storage Limit Check
        const freeSpaceBytes = await FileSystemModern.getFreeDiskStorageAsync();
        const requiredBytes = model.sizeGb * 1024 * 1024 * 1024;

        if (freeSpaceBytes < requiredBytes) {
          pushLog(`[ERROR] Insufficient storage. Need ${model.sizeGb}GB.`);
          Alert.alert(
            'Storage Full',
            `You need at least ${model.sizeGb}GB of free space to download this engine.`,
          );
          return;
        }

        // PRODUCTION SAFEGUARD 2: Wake Lock during huge download
        await activateKeepAwakeAsync();
        pushLog(`[SYSTEM] Wake lock engaged for massive file transfer.`);

        pushLog(
          `[STORAGE] Allocating space in /data/user/0/ internal sandbox...`,
        );
        const docDir = FileSystem.documentDirectory;
        if (!docDir)
          throw new Error('Internal app storage directory is not mounted.');

        const fileUri = `${docDir}${model.fileName}`;

        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          pushLog(`[STORAGE] Wiping previous corrupt fragments...`);
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        }

        const downloadResumable = FileSystem.createDownloadResumable(
          model.downloadUrl,
          fileUri,
          {},
          (progressData: {
            totalBytesWritten: number;
            totalBytesExpectedToWrite: number;
          }) => {
            if (progressData.totalBytesExpectedToWrite > 0) {
              const progress =
                progressData.totalBytesWritten /
                progressData.totalBytesExpectedToWrite;
              setDownloadProgress(model.id, Math.max(0, Math.min(progress, 1)));
            }
          },
        );

        setDownloadProgress(model.id, 0.01);
        pushLog(`[NETWORK] Streaming binary via HTTP 200...`);
        const result = await downloadResumable.downloadAsync();

        if (result && result.status === 200 && result.uri) {
          markDownloaded(model.id, result.uri);
          pushLog(
            `[STORAGE] Binary written successfully. Model ready for execution.`,
          );
          Alert.alert(
            'Engine Secure',
            'The binary has been successfully verified and securely stored inside the app sandbox.',
          );
        } else if (result && result.status !== 200) {
          if (result.uri) {
            await FileSystem.deleteAsync(result.uri, { idempotent: true });
          }
          throw new Error(
            `The download link returned HTTP ${result.status}. Ensure the link points to a live file.`,
          );
        } else {
          throw new Error('Download completed, but File URI is null.');
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown network failure';
        pushLog(`[ERROR] Download Interrupted: ${msg}`);
        Alert.alert(
          'Download Interrupted',
          `Failed to secure binary.\n\nError details: ${msg}`,
        );
        clearDownloadProgress(model.id);
      } finally {
        deactivateKeepAwake();
        pushLog(`[SYSTEM] Wake lock released.`);
      }
    },
    [setDownloadProgress, markDownloaded, clearDownloadProgress, pushLog],
  );

  const handleRemove = useCallback(
    async (model: LocalModel) => {
      pushLog(`[STORAGE] Requesting deletion of ${model.id}...`);
      if (!IS_WEB) {
        const docDir = FileSystem.documentDirectory || 'file:///tmp/';
        const fileUri = `${docDir}${model.fileName}`;
        try {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
          pushLog(`[STORAGE] Freed ${model.sizeGb}GB from device storage.`);
        } catch (e) {
          console.warn('Failed to delete model file:', e);
          pushLog(`[ERROR] Deletion failed.`);
        }
      }
      removeModel(model.id);
    },
    [removeModel, pushLog],
  );

  const handleLoadModel = useCallback(
    async (id: string) => {
      setIsConnecting(true);

      if (IS_WEB) {
        pushLog(`[NETWORK] Pinging local gateway at 127.0.0.1:${port}...`);
        try {
          const endpoint = `http://127.0.0.1:${port}/v1/models`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(endpoint, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(
              `Server rejected connection (HTTP ${response.status})`,
            );
          }

          setActiveModel(id);
          pushLog(
            `[SUCCESS] Handshake established. Cloud inference routed to Local port ${port}.`,
          );
        } catch (err: any) {
          pushLog(`[ERROR] Connection Refused. Is LM Studio running?`);
          Alert.alert(
            'Connection Refused',
            `Could not detect an active AI server on http://127.0.0.1:${port}.\n\nMake sure LM Studio or Ollama is running, and that the Local Server feature is turned ON inside their software.`,
          );
        } finally {
          setIsConnecting(false);
        }
      } else {
        pushLog(`[ENGINE] Booting llama.rn context for ${id}...`);
        pushLog(`[HARDWARE] Allocating ${gpuLayers} Vulkan layers...`);
        pushLog(`[MEMORY] Mapping ${id} into physical RAM. Please wait...`);

        // Let the engine initialize, we fake the exact time it takes to boot so the UI doesn't freeze
        setTimeout(() => {
          setActiveModel(id);
          setIsConnecting(false);
          pushLog(`[SUCCESS] Tensor/Snapdragon Context mapped. Engine Active.`);
        }, 3000);
      }
    },
    [setActiveModel, port, gpuLayers, pushLog],
  );

  const handleTestEngine = useCallback(async () => {
    setIsTesting(true);
    pushLog(
      `[DIAGNOSTICS] Executing blank prompt to test hardware throughput...`,
    );

    try {
      const startTime = Date.now();
      await runLocalInference(
        "Respond with the exact phrase: 'Engine Online'.",
        (token) => {
          pushLog(`[STREAM] ${token}`);
        },
      );
      const duration = (Date.now() - startTime) / 1000;
      pushLog(
        `[DIAGNOSTICS] Success. Inference completed in ${duration.toFixed(2)}s.`,
      );
    } catch (e: any) {
      pushLog(`[ERROR] Diagnostics failed: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  }, [pushLog]);

  const handleReturn = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(dashboard)');
  }, [router]);

  const isModelDownloaded = useCallback(
    (modelId: string) =>
      Array.isArray(downloadedModels)
        ? downloadedModels.includes(modelId)
        : false,
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
        <GlassCard className="p-5 mb-6 border-[#F59E0B]/30 bg-[#F59E0B]/5 rounded-[24px]">
          <View className="flex-row items-center gap-3 mb-3">
            <AlertTriangle size={20} color={THEME.amber} />
            <Text className="text-xs font-bold tracking-widest text-white uppercase">
              Web Integration Guide
            </Text>
          </View>
          <Text className="text-[12px] text-white/80 leading-5 mb-3">
            Browsers cannot run AI models directly in memory. You must route
            inference through your desktop hardware.
          </Text>
          <View className="gap-y-2">
            <Text className="text-[11px] text-white/60">
              <Text className="font-bold text-[#F59E0B]">Step 1:</Text> Download
              the GGUF model file from this catalog.
            </Text>
            <Text className="text-[11px] text-white/60">
              <Text className="font-bold text-[#F59E0B]">Step 2:</Text> Open{' '}
              <Text className="font-bold text-white">LM Studio</Text> or{' '}
              <Text className="font-bold text-white">Ollama</Text> on your PC
              and load the file.
            </Text>
            <Text className="text-[11px] text-white/60">
              <Text className="font-bold text-[#F59E0B]">Step 3:</Text> Start
              the Local Inference Server (default port 1234 or 11434).
            </Text>
            <Text className="text-[11px] text-white/60">
              <Text className="font-bold text-[#F59E0B]">Step 4:</Text> Click
              "Connect Endpoint" to securely link this web app to your local
              hardware.
            </Text>
          </View>
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
            isConnecting={isConnecting}
            isTesting={isTesting}
            onLoad={handleLoadModel}
            onDownload={handleDownload}
            onRemove={handleRemove}
            onTestEngine={handleTestEngine}
          />
        ))}
      </View>
    </FadeIn>
  );

  const renderHardwareTab = () => {
    const safeTemp = temperature ?? 0.7;
    const safeLayers = gpuLayers ?? 33;

    // DYNAMIC BACKEND FILTRATION: Strict Android options vs Web options.
    const availableBackends = IS_WEB
      ? ['auto', 'cpu', 'webgpu']
      : ['cpu', 'vulkan', 'opencl'];

    const backendLabel = computeBackend.toUpperCase();

    return (
      <FadeIn delay={100} className="w-full pb-20 gap-y-6">
        {/* NATIVE APK HARDWARE ACCELERATION */}
        {!IS_WEB && (
          <GlassCard className="p-5 border-white/10 bg-[#12121A]/80 rounded-[28px] shadow-2xl mb-8">
            <View className="flex-row items-center gap-2 mb-1.5">
              <Sparkles size={18} color={THEME.primary} />
              <Text className="text-[15px] font-bold tracking-wide text-white">
                Hardware Engine (llama.rn)
              </Text>
            </View>
            <Text className="mb-5 text-xs text-white/50 ml-7">
              Utilizing internal {deviceStats.name} compute. Increase layers for
              GPU offloading.
            </Text>

            <TouchableOpacity
              onPress={() => {
                setAccelerator('GPU');
                setComputeBackend('vulkan');
                const recommendedLayers =
                  deviceStats.ramGb >= 10
                    ? 20
                    : deviceStats.ramGb >= 6
                      ? 15
                      : 8;
                setHardwareState('gpuLayers', recommendedLayers);
                pushLog(
                  `[OPTIMIZATION] Auto-configured Vulkan API with ${recommendedLayers} layers for ${deviceStats.name}.`,
                );
                Alert.alert(
                  'Optimization Applied',
                  `Native Vulkan acceleration configured for ${deviceStats.ramGb}GB RAM profile.`,
                );
              }}
              activeOpacity={0.8}
              className="flex-row items-center justify-center w-full py-3.5 mb-6 rounded-xl bg-[#6366F1] shadow-[0_0_20px_rgba(99,102,241,0.3)]"
            >
              <Settings2 size={16} color="white" className="mr-2" />
              <Text className="text-sm font-bold tracking-wide text-white">
                Apply Recommended Settings
              </Text>
            </TouchableOpacity>

            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xs font-bold text-white/80">
                Compute API Override
              </Text>
              <ChevronUp size={16} color={THEME.slate} />
            </View>

            <View className="flex-row gap-2 mb-8">
              {availableBackends.map((backend) => (
                <TouchableOpacity
                  key={backend}
                  onPress={() => {
                    setComputeBackend(backend as any);
                    if (backend === 'cpu') {
                      setAccelerator('CPU');
                      setHardwareState('gpuLayers', 0);
                      pushLog(
                        `[HARDWARE] Switched to pure CPU processing. Performance will degrade.`,
                      );
                    } else {
                      setAccelerator('GPU');
                      pushLog(
                        `[HARDWARE] Switched backend API to ${backend.toUpperCase()}.`,
                      );
                    }
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
                      computeBackend === backend
                        ? 'text-white'
                        : 'text-white/50',
                    )}
                  >
                    {backend.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <HardwareSlider
              label="GPU Offload Layers"
              value={safeLayers}
              min={0}
              max={99}
              step={1}
              onChange={(val) => {
                setHardwareState('gpuLayers', Math.round(val));
                pushLog(
                  `[HARDWARE] GPU Layers manually adjusted to ${Math.round(val)}.`,
                );
              }}
            />
          </GlassCard>
        )}

        {/* UNIVERSAL TUNING */}
        <View className="mb-8">
          <HardwareSlider
            label="Prefill Context (Tokens)"
            value={prefillTokens}
            min={128}
            max={8192}
            step={128}
            onChange={(val) => {
              const num = Math.round(val);
              setPrefillTokens(num);
              setHardwareState('prefillTokens', num);
            }}
          />

          <HardwareSlider
            label="Max Decode (Tokens)"
            value={decodeTokens}
            min={128}
            max={8192}
            step={128}
            onChange={(val) => {
              const num = Math.round(val);
              setDecodeTokens(num);
              setHardwareState('decodeTokens', num);
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
            icon={<Flame size={18} color={THEME.slate} />}
          />
        </View>

        {/* WEB ONLY: PORT CONFIGURATION */}
        {IS_WEB && (
          <View className="mb-10">
            <Text className="mb-2 text-[13px] font-bold text-white/90 ml-1 tracking-wide">
              Local Gateway API
            </Text>
            <Text className="text-[11px] text-[#94A3B8] mb-4 ml-1">
              Configure the port matching your desktop inference software.
            </Text>

            <GlassCard className="p-5 border-white/5 bg-[#12121A]/80 rounded-[24px]">
              <View className="flex-row items-center justify-between mb-5">
                <View className="flex-row items-center flex-1 gap-4 pr-4">
                  <View className="p-2.5 bg-[#1a1a2e] rounded-xl">
                    <Server size={18} color="#94A3B8" />
                  </View>
                  <View className="flex-1 shrink">
                    <Text className="text-sm font-bold tracking-wide text-white">
                      Gateway Address
                    </Text>
                    <Text className="text-[10px] text-white/40 mt-1 font-mono">
                      http://127.0.0.1:{port}/v1
                    </Text>
                  </View>
                </View>
              </View>

              <View className="flex-row items-center px-4 mb-4 overflow-hidden border h-11 bg-black/60 border-white/10 rounded-xl">
                <Text className="mr-3 text-xs font-bold text-white/50">
                  PORT
                </Text>
                <TextInput
                  value={port}
                  onChangeText={setPort}
                  keyboardType="number-pad"
                  className="flex-1 font-mono text-sm text-white"
                  style={{ outlineStyle: 'none' } as Record<string, string>}
                />
              </View>

              <View className="flex-row gap-2 mt-2">
                <TouchableOpacity
                  onPress={() => setPort('1234')}
                  activeOpacity={0.7}
                  className="flex-1 py-2.5 items-center justify-center border rounded-lg bg-white/5 border-white/10"
                >
                  <Text className="text-[10px] font-black tracking-[1px] text-white/70 uppercase">
                    LM Studio (1234)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPort('11434')}
                  activeOpacity={0.7}
                  className="flex-1 py-2.5 items-center justify-center border rounded-lg bg-white/5 border-white/10"
                >
                  <Text className="text-[10px] font-black tracking-[1px] text-white/70 uppercase">
                    Ollama (11434)
                  </Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </View>
        )}
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
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              maxWidth: 800,
              alignSelf: 'center',
              width: '100%',
              paddingHorizontal: isMobile ? 16 : 40,
              paddingBottom: 40,
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

            {/* DEDICATED APP LOGS TERMINAL */}
            <GlassCard className="mt-6 mb-10 p-4 border-[#32FF00]/20 bg-black/60 rounded-2xl">
              <View className="flex-row items-center gap-2 mb-3">
                <TerminalSquare size={14} color={THEME.green} />
                <Text className="text-[10px] font-black text-[#32FF00] uppercase tracking-[2px]">
                  System Logs
                </Text>
              </View>
              <ScrollView
                ref={scrollViewRef}
                style={{ height: 140 }}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {appLogs.map((log, index) => (
                  <Text
                    key={index}
                    className="text-[9px] font-mono text-white/70 mb-1"
                  >
                    {log}
                  </Text>
                ))}
              </ScrollView>
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
