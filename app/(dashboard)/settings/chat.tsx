/**
 * @file app/(dashboard)/settings/chat.tsx
 * @description Local AI Chat Sandbox - Liquid Neon Design
 * ----------------------------------------------------------------------------
 * DESIGN PRINCIPLES:
 * - ADAPTIVE KEYBOARD: Uses explicit Keyboard.addListener to push the UI up
 *   perfectly without colliding with the Android Navigation Bar.
 * - STATE RECOVERY: Ensures `capturedStream` resolves gracefully to avoid
 *   showing "[Empty Response]" or "[Engine Ready]" when the model stalls.
 * ----------------------------------------------------------------------------
 */

import React, {
  useState,
  useRef,
  useEffect,
  memo,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Keyboard,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useRouter, useNavigation, Stack } from 'expo-router';
import {
  ArrowLeft,
  Send,
  Cpu,
  Trash2,
  User,
  AlertCircle,
  ArrowBigLeftDash,
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  FadeInDown,
} from 'react-native-reanimated';

import { THEME } from '../../../constants/theme';
import { useLocalAIStore } from '../../../store/useLocalAIStore';
import { AVAILABLE_MODELS } from '../../../constants/models';
import {
  runLocalChatInference,
  abortNativeInference,
} from '../../../services/localInference';
import { FadeIn } from '../../../components/animations/FadeIn';
import { cn } from '../../../lib/utils';

const IS_WEB = Platform.OS === 'web';
const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

// ─── AMBIENT ARCHITECTURE ───────────────────────────────────────────────────

interface NeuralOrbProps {
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

const NeuralOrb = memo(
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
  }: NeuralOrbProps) => {
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

const AmbientBackground = memo(() => (
  <View
    style={[
      StyleSheet.absoluteFill,
      { zIndex: -1, backgroundColor: '#030811' },
    ]}
    pointerEvents="none"
  >
    <NeuralOrb
      color={THEME.colors.neon.purple}
      size={WINDOW_WIDTH * 0.7}
      initialX={WINDOW_WIDTH * 0.8}
      initialY={WINDOW_HEIGHT * 0.6}
      speedX={0.12}
      speedY={0.18}
      phaseOffsetX={Math.PI}
      phaseOffsetY={0}
      opacityBase={0.05}
    />
    <NeuralOrb
      color={THEME.colors.neon.cyan}
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

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  isError?: boolean;
}

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────────

const MessageBubble = memo(
  ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMe = item.role === 'user';
    const roleColor = isMe ? THEME.colors.neon.cyan : THEME.colors.neon.purple;
    const authorName = isMe ? 'You' : 'Local Engine';

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 10).springify()}
        className={cn(
          'flex-row items-end mb-6 gap-3 w-full',
          isMe ? 'justify-end' : 'justify-start',
        )}
      >
        {!isMe && (
          <View className="items-center mb-1">
            <View
              className="items-center justify-center border rounded-full w-9 h-9"
              style={{
                backgroundColor: `${roleColor}15`,
                borderColor: roleColor,
              }}
            >
              <Cpu size={18} color={roleColor} />
            </View>
          </View>
        )}

        <View
          className="flex-shrink"
          style={{
            maxWidth: IS_WEB ? '75%' : '85%',
            alignItems: isMe ? 'flex-end' : 'flex-start',
          }}
        >
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-white/70 text-[11px] font-bold uppercase tracking-wider">
              {authorName}
            </Text>
            <View
              className="border px-1.5 py-0.5 rounded-md"
              style={{
                backgroundColor: `${roleColor}15`,
                borderColor: `${roleColor}40`,
              }}
            >
              <Text
                className="text-[8px] font-black uppercase tracking-widest"
                style={{ color: roleColor }}
              >
                {isMe ? 'USER' : 'AI'}
              </Text>
            </View>
          </View>

          <View
            className="px-4 py-3.5 border"
            style={{
              backgroundColor: isMe
                ? `${THEME.colors.neon.purple}20`
                : THEME.colors.card,
              borderColor: isMe
                ? `${THEME.colors.neon.purple}40`
                : THEME.colors.cardBorder,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderBottomRightRadius: isMe ? 4 : 20,
              borderBottomLeftRadius: isMe ? 20 : 4,
            }}
          >
            <Text
              className={cn(
                'text-[15px] leading-6',
                item.isError ? 'text-red-400 font-mono' : 'text-white',
              )}
              style={
                IS_WEB
                  ? ({ wordBreak: 'break-word', whiteSpace: 'pre-wrap' } as any)
                  : {}
              }
            >
              {item.content}
            </Text>
          </View>
        </View>

        {isMe && (
          <View className="items-center mb-1">
            <View
              className="items-center justify-center border rounded-full w-9 h-9"
              style={{
                backgroundColor: `${roleColor}15`,
                borderColor: roleColor,
              }}
            >
              <User size={18} color={roleColor} />
            </View>
          </View>
        )}
      </Animated.View>
    );
  },
);

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function LocalChatSandbox() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { activeModelId } = useLocalAIStore();

  const activeModel = useMemo(
    () => AVAILABLE_MODELS.find((m) => m.id === activeModelId),
    [activeModelId],
  );

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const isMobile = WINDOW_WIDTH < 768;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });

    if (Platform.OS === 'web') return;

    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
      scrollToBottom();
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      abortNativeInference();
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [navigation]);

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 100);
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isTyping || !activeModelId) return;

    const userMsg = input.trim();
    setInput('');
    Keyboard.dismiss();

    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMsg,
    };
    setMessages((prev) => [...prev, newUserMsg]);
    setIsTyping(true);
    setStreamedText('');
    scrollToBottom();

    try {
      const historyForEngine = [...messages, newUserMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let capturedStream = '';

      const response = await runLocalChatInference(
        historyForEngine,
        (token) => {
          capturedStream += token;
          setStreamedText(capturedStream);
          scrollToBottom(false);
        },
      );

      const finalContent = response?.trim() || capturedStream.trim();

      // FIX: Ensure we never just output raw [Engine Ready] if the local model stalls due to Q8 cache issues
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content:
            finalContent ||
            '[Model Stalled: Decrease Context Limit and Reload]',
        },
      ]);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: `[SYSTEM ERROR]: ${errMsg}`,
          isError: true,
        },
      ]);
    } finally {
      setIsTyping(false);
      setStreamedText('');
      scrollToBottom();
    }
  }, [input, isTyping, activeModelId, messages, scrollToBottom]);

  const clearChat = useCallback(async () => {
    setMessages([]);
    setStreamedText('');
    await abortNativeInference();
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => (
      <MessageBubble item={item} index={index} />
    ),
    [],
  );

  const listEmptyComponent = useMemo(
    () => (
      <View className="items-center justify-center flex-1 mt-20 opacity-60">
        <View className="p-5 bg-purple-500/10 rounded-[40px] border border-purple-500/30 mb-5">
          <Cpu size={40} color={THEME.colors.neon.purple} />
        </View>
        <Text className="text-white font-black uppercase tracking-[2px] text-base">
          Sandbox Ready
        </Text>
        <Text className="text-cyan-400 text-[12px] mt-3 font-mono opacity-80">
          {activeModel?.name || activeModelId}
        </Text>
      </View>
    ),
    [activeModelId],
  );

  const listFooterComponent = useMemo(() => {
    if (!isTyping) return null;
    return (
      <Animated.View
        entering={FadeInDown.springify()}
        className="flex-row items-end justify-start w-full gap-3 mb-6"
      >
        <View className="items-center mb-1">
          <View
            className="items-center justify-center border rounded-full w-9 h-9"
            style={{
              backgroundColor: `${THEME.colors.neon.purple}15`,
              borderColor: THEME.colors.neon.purple,
            }}
          >
            <Cpu size={18} color={THEME.colors.neon.purple} />
          </View>
        </View>
        <View
          className="flex-shrink"
          style={{ maxWidth: IS_WEB ? '75%' : '85%', alignItems: 'flex-start' }}
        >
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-white/70 text-[11px] font-bold uppercase tracking-wider">
              Local Engine
            </Text>
          </View>
          <View
            className="px-4.5 py-3.5 border min-w-[120px]"
            style={{
              backgroundColor: THEME.colors.card,
              borderColor: THEME.colors.cardBorder,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderBottomRightRadius: 20,
              borderBottomLeftRadius: 4,
            }}
          >
            {streamedText ? (
              <Text className="text-[15px] leading-6 text-white">
                {streamedText}
              </Text>
            ) : (
              <View className="flex-row items-center gap-2.5">
                <ActivityIndicator
                  size="small"
                  color={THEME.colors.neon.green}
                />
                <Text className="text-green-400 text-[11px] font-black uppercase tracking-widest">
                  Reasoning
                </Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    );
  }, [isTyping, streamedText]);

  const dynamicBottomPadding = isMobile
    ? isKeyboardVisible
      ? keyboardHeight + 12
      : Math.max(insets.bottom + 100, 110)
    : 24;

  return (
    <View className="flex-1" style={{ backgroundColor: '#030811' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <AmbientBackground />

      <SafeAreaView className="z-10 flex-1" edges={['top']}>
        <View className="flex-1 w-full max-w-[672px] self-center">
          <View
            className="flex-row items-center justify-end px-4 py-3 mx-4 mt-2 border rounded-3xl"
            style={{
              borderColor: 'rgba(255, 255, 255, 0.05)',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <TouchableOpacity
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace('/settings/models')
              }
              className="absolute z-50 flex-row items-center left-4 gap-x-2 active:scale-95"
              activeOpacity={0.7}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <ArrowBigLeftDash size={20} color={THEME.colors.neon.cyan} />
              <Text className="text-[10px] font-black tracking-[4px] text-[#00F0FF] uppercase hidden md:flex">
                MODELS
              </Text>
            </TouchableOpacity>

            <View
              pointerEvents="none"
              className="absolute inset-0 flex-row items-center justify-center"
            >
              <Text className="text-white/80 text-[10px] font-mono uppercase tracking-[2px]">
                {activeModel?.name || activeModelId || 'Offline'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={clearChat}
              className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl border"
              style={{
                backgroundColor: `${THEME.colors.neon.red}10`,
                borderColor: `${THEME.colors.neon.red}20`,
              }}
            >
              <Trash2 color={THEME.colors.neon.red} size={14} />
              <Text className="text-red-500 font-black text-[10px] tracking-widest uppercase">
                Clear
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-1">
            {!activeModelId ? (
              <FadeIn className="items-center justify-center flex-1 p-5 opacity-50">
                <AlertCircle size={36} color={THEME.colors.text.secondary} />
                <Text className="mt-6 text-lg font-black tracking-widest text-white">
                  No Engine Loaded
                </Text>
                <Text className="text-zinc-400 mt-3 text-sm text-center max-w-[300px] leading-[12px]">
                  Return to the Models catalog, download an engine, and select
                  "Load Model" to initialize the hardware.
                </Text>
              </FadeIn>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingTop: 24,
                  paddingBottom: 24,
                  flexGrow: 1,
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={listEmptyComponent}
                renderItem={renderItem}
                ListFooterComponent={listFooterComponent}
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
              />
            )}
          </View>

          <View
            className="px-4 pt-2 pb-6"
            style={{ paddingBottom: dynamicBottomPadding }}
          >
            <View
              className="flex-row items-end gap-3 rounded-[32px] border min-h-[64px] max-h-[150px] overflow-hidden"
              style={{
                borderColor: 'rgba(255, 255, 255, 0.08)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
              }}
            >
              <TextInput
                className="flex-1 text-white px-6 py-5 text-[15px]"
                style={IS_WEB ? ({ outlineStyle: 'none' } as any) : {}}
                placeholder={
                  activeModelId ? 'Send a message...' : 'Engine offline...'
                }
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={input}
                onChangeText={setInput}
                editable={!isTyping && !!activeModelId}
                multiline
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={isTyping || !input.trim() || !activeModelId}
                className={cn(
                  'w-12 h-12 rounded-full items-center justify-center m-2 self-end',
                  input.trim() && !isTyping && activeModelId
                    ? 'bg-cyan-400'
                    : 'bg-white/10',
                )}
              >
                <Send
                  size={20}
                  color={
                    input.trim() && !isTyping && activeModelId
                      ? '#030811'
                      : 'rgba(255,255,255,0.5)'
                  }
                  style={{ marginLeft: input.trim() ? -2 : 0 }}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
