/**
 * @file app/(dashboard)/settings/support.tsx
 * @description VeraxAI Enterprise Support & Secure Messaging Hub.
 * ══════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE & PROTOCOL
 * DOM ISOLATIONbackground is strictly locked to zIndex 0 and
 * Foreground lists and chat windows are elevated to zIndex 10 for safe Android taps
 * The display queue is mathematically memoized to
 * guarantee Premium/Pro members are always prioritized at the top of the queue.
 * Messages are injected into the DOM at 0ms latency before
 * the network request completes, eliminating perceived chat lag.
 * TOUCH ENGINE: Legacy TouchableOpacity replaced globally with Pressable.
 * ══════════════════════════════════════════════════════════════════════════════
 */

// ─── MODULE IMPORTS ──────────────────────────────────────────────────────────
import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  Keyboard,
  StyleSheet,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useRouter, Stack, useNavigation } from 'expo-router';

// ─── ICONOGRAPHY ─────────────────────────────────────────────────────────────
import {
  MessageSquare,
  Plus,
  Search,
  Send,
  CheckCircle2,
  Trophy,
  Lock,
  Trash2,
  Code,
  User as UserIcon,
  Shield,
  ShieldCheck,
  ChevronDown,
  Zap,
  XCircle,
  ArrowBigLeftDash,
} from 'lucide-react-native';

// ─── ANIMATIONS & NATIVE SVG ─────────────────────────────────────────────────
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  withDelay,
  Easing,
  withSequence,
  FadeInUp,
  FadeInDown,
  useFrameCallback,
} from 'react-native-reanimated';
import Svg, { Path, Circle, G, Rect } from 'react-native-svg';

// ─── CORE SERVICES ───────────────────────────────────────────────────────────
import { supabase } from '../../../lib/supabase/client';
import { useAuthStore } from '../../../store/useAuthStore';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Database } from '../../../types/database/database.types';

// ─── ENVIRONMENT & DIMENSIONS ────────────────────────────────────────────────
const IS_WEB = Platform.OS === 'web';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── STRICT LOCAL COLORS ─────────────────────────────────────────────────────
const C_APP_BG = '#000012'; // Unified with Settings root
const C_CYAN = '#00F0FF';
const C_PURPLE = '#8A2BE2';
const C_GREEN = '#32FF00';
const C_PINK = '#FF007F';
const C_AMBER = '#F59E0B';
const C_NAVY = '#1A3370';
const C_SLATE = '#94A3B8';

// ─── TYPES & CONSTANTS ───────────────────────────────────────────────────────
const STAFF_ROLES = ['admin', 'support'];
type UserRole = 'member' | 'premium' | 'support' | 'admin';
type TicketStatus =
  | 'open'
  | 'underreview'
  | 'in_progress'
  | 'resolved'
  | 'closed';
type FilterStatus = 'my_tickets' | 'queue' | 'all_tickets' | 'faq';

type TicketRow = Database['public']['Tables']['tickets']['Row'];
type MessageRow = Database['public']['Tables']['ticket_messages']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export interface TicketUI extends Omit<TicketRow, 'priority' | 'status'> {
  status: TicketStatus;
  priority?: string;
  user?: Pick<ProfileRow, 'full_name' | 'email' | 'role' | 'avatar_url'>;
  messages?: MessageUI[];
}

export interface MessageUI extends MessageRow {
  author?: Pick<ProfileRow, 'full_name' | 'email' | 'role' | 'avatar_url'>;
}

const FAQ_DATA = [
  {
    id: '1',
    icon: Zap,
    color: C_CYAN,
    question: 'How fast is the transcription?',
    answer:
      'Powered by Deepgram Nova-2, processing typically takes under 30 seconds for a 30-minute video.',
  },
  {
    id: '2',
    icon: Trophy,
    color: C_GREEN,
    question: 'How accurate are the AI Insights?',
    answer:
      'We utilize Gemini 3.1 Flash-Lite, specifically tuned for contextual understanding and SEO extraction.',
  },
  {
    id: '3',
    icon: Code,
    color: C_PURPLE,
    question: 'Can I use my own API Keys?',
    answer:
      'Yes. Premium members can navigate to Settings > Security to inject custom fallback keys.',
  },
  {
    id: '4',
    icon: Lock,
    color: C_PINK,
    question: 'Are my transcripts secure?',
    answer:
      'Absolutely. We employ strict Row Level Security (RLS). No one else can query your data.',
  },
];

// ─── UTILITY FUNCTIONS ───────────────────────────────────────────────────────

const getRoleColor = (role: string | undefined) => {
  switch (role?.toLowerCase()) {
    case 'admin':
      return C_PINK;
    case 'support':
      return C_GREEN;
    case 'premium':
      return C_AMBER;
    default:
      return C_CYAN;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open':
      return C_GREEN;
    case 'in_progress':
      return C_CYAN;
    case 'underreview':
      return C_AMBER;
    case 'resolved':
      return C_PURPLE;
    case 'closed':
      return C_SLATE;
    default:
      return C_SLATE;
  }
};

// ─── UI COMPONENTS ───────────────────────────────────────────────────────────

const RoleBadge = ({ role }: { role: string | undefined }) => {
  const safeRole = (role || 'member').toLowerCase() as UserRole;
  const color = getRoleColor(safeRole);
  let IconComponent = UserIcon;
  let label = 'MEMBER';

  if (safeRole === 'admin') {
    IconComponent = Shield;
    label = 'ADMIN';
  } else if (safeRole === 'support') {
    IconComponent = ShieldCheck;
    label = 'SUPPORT';
  } else if (safeRole === 'premium') {
    IconComponent = Zap;
    label = 'PRO';
  }

  return (
    <View
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <IconComponent size={10} color={color} />
      <Text
        style={{
          color,
          fontSize: 8,
          fontWeight: '900',
          marginLeft: 4,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {label}
      </Text>
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULE: SETTINGS-PARITY BACKGROUND (Wandering Core Engine)
// ══════════════════════════════════════════════════════════════════════════════
interface SingleRippleProps {
  color: string;
  delay: number;
  duration: number;
  maxSize: number;
}

const SingleRipple = React.memo(
  ({ color, delay, duration, maxSize }: SingleRippleProps) => {
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
    }, [delay, duration, progress]);

    const animatedStyle = useAnimatedStyle(() => ({
      width: interpolate(progress.value, [0, 1], [0, maxSize]),
      height: interpolate(progress.value, [0, 1], [0, maxSize]),
      borderRadius: interpolate(progress.value, [0, 1], [0, maxSize / 2]),
      opacity: interpolate(
        progress.value,
        [0, 0.1, 0.8, 1],
        [0, 0.15, 0.02, 0],
      ),
      borderWidth: interpolate(progress.value, [0, 1], [60, 20]),
    }));

    return (
      <Animated.View
        pointerEvents="none"
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

interface WanderingCoreProps {
  coreSize: number;
  color: string;
  maxWaveSize: number;
  waveCount: number;
  baseDuration: number;
}

const WanderingCore = React.memo(
  ({
    coreSize,
    color,
    maxWaveSize,
    waveCount,
    baseDuration,
  }: WanderingCoreProps) => {
    const { width, height } = Dimensions.get('window');
    const time = useSharedValue(0);

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

    const corePulse = useSharedValue(0.4);
    useEffect(() => {
      corePulse.value = withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }, [corePulse]);

    const coreStyle = useAnimatedStyle(() => ({
      opacity: interpolate(corePulse.value, [0.4, 1], [0.4, 1]),
      transform: [
        { scale: interpolate(corePulse.value, [0.4, 1], [0.8, 1.2]) },
      ],
    }));

    return (
      <Animated.View
        pointerEvents="none"
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
          <SingleRipple
            key={`ripple-${index}`}
            color={color}
            delay={index * (baseDuration / waveCount)}
            duration={baseDuration}
            maxSize={maxWaveSize}
          />
        ))}
        <Animated.View
          pointerEvents="none"
          style={[
            coreStyle,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
              backgroundColor: color,
              ...(IS_WEB
                ? ({ boxShadow: `0 0 20px ${color}` } as any)
                : {
                    shadowColor: color,
                    shadowRadius: 15,
                    shadowOpacity: 1,
                    shadowOffset: { width: 0, height: 0 },
                  }),
            },
          ]}
        />
      </Animated.View>
    );
  },
);

const AmbientArchitecture = React.memo(() => {
  const { width, height } = Dimensions.get('window');
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { zIndex: 0, elevation: 0, pointerEvents: 'none' },
      ]}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <WanderingCore
        coreSize={14}
        color={C_CYAN}
        maxWaveSize={width >= 1024 ? width * 0.8 : height * 1.0}
        waveCount={4}
        baseDuration={12000}
      />
    </View>
  );
});

// ─── FLOATING ICONS & CONTROLS ────────────────────────────────────────────────

const AnimatedSupportIcon = () => {
  const floatY = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  return (
    <Animated.View
      style={[{ width: 120, height: 120, alignSelf: 'center' }, floatStyle]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <G transform="translate(10, 35)">
          <Path
            d="M0 5 C0 2.24 2.24 0 5 0 L 45 0 C 47.76 0 50 2.24 50 5 L 50 35 C 50 37.76 47.76 40 45 40 L 25 40 L 15 50 L 15 40 L 5 40 C 2.24 40 0 37.76 0 35 Z"
            fill={C_AMBER}
            stroke={C_NAVY}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <Rect
            x="10"
            y="10"
            width="20"
            height="4"
            rx="2"
            fill="white"
            opacity="0.8"
          />
          <Rect
            x="10"
            y="20"
            width="30"
            height="4"
            rx="2"
            fill="white"
            opacity="0.8"
          />
        </G>
        <G transform="translate(40, 15)">
          <Path
            d="M 25 0 C 38.8 0 50 11.2 50 25 C 50 38.8 38.8 50 25 50 C 20.8 50 16.8 49 13.4 47.3 L 2 52 L 5.8 41.5 C 2.2 37.2 0 31.3 0 25 C 0 11.2 11.2 0 25 0 Z"
            fill={C_CYAN}
            stroke={C_NAVY}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <Circle cx="25" cy="15" r="4" fill="white" />
          <Path d="M 18 35 C 18 28 32 28 32 35 Z" fill="white" />
        </G>
      </Svg>
    </Animated.View>
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
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
        borderColor: active ? C_CYAN + '50' : 'rgba(255,255,255,0.08)',
        backgroundColor: active ? C_CYAN + '10' : 'transparent',
        opacity: pressed ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      },
    ]}
  >
    <Text
      style={{
        color: active ? C_CYAN : 'rgba(255,255,255,0.38)',
        fontSize: 11,
        fontWeight: active ? '700' : '400',
        letterSpacing: 0.4,
      }}
    >
      {label}
    </Text>
  </Pressable>
);

const PillGlowButton = ({ title, onPress, isLoading, icon: Icon }: any) => (
  <Pressable
    onPress={onPress}
    disabled={isLoading}
    style={({ pressed }) => [
      {
        backgroundColor: C_CYAN + '15',
        borderColor: C_CYAN + '50',
        borderWidth: 1,
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        maxWidth: 280,
        alignSelf: 'center',
        opacity: pressed ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      },
    ]}
  >
    {isLoading ? (
      <ActivityIndicator size="small" color={C_CYAN} />
    ) : (
      <>
        {Icon && <Icon size={16} color={C_CYAN} />}
        <Text
          style={{
            color: C_CYAN,
            fontSize: 12,
            fontWeight: '900',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </Text>
      </>
    )}
  </Pressable>
);

// ─── MAIN SCREEN COMPONENT ───────────────────────────────────────────────────

export default function SupportScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user, profile } = useAuthStore();
  const flatListRef = useRef<FlatList<MessageUI>>(null);
  const insets = useSafeAreaInsets();

  const isMobile = SCREEN_WIDTH < 768;

  // ─── KEYBOARD & PADDING MANAGEMENT ───
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    });
    const hideSub = Keyboard.addListener(hideEvent, () =>
      setKeyboardVisible(false),
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const bottomChatPadding = isMobile
    ? isKeyboardVisible
      ? 12
      : Math.max(insets.bottom + 120, 130)
    : 24;

  // ─── ROLE LOGIC ───
  const realRole = (profile?.role || 'member').toLowerCase() as UserRole;
  const isStaff = STAFF_ROLES.includes(realRole);
  const isAdmin = realRole === 'admin';

  // ─── STATE HOOKS ───
  const [filter, setFilter] = useState<FilterStatus>('my_tickets');
  const [tickets, setTickets] = useState<TicketUI[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'create'>(
    'list',
  );
  const [selectedTicket, setSelectedTicket] = useState<TicketUI | null>(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Technical Issue');
  const [newInitialMsg, setNewInitialMsg] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (isStaff && viewMode === 'list' && filter === 'my_tickets')
      setFilter('queue');
  }, [isStaff, viewMode]);

  // ─── REALTIME WEBSOCKET SUBSCRIPTION ───
  useEffect(() => {
    if (viewMode !== 'detail' || !selectedTicket) return;

    const channelName = `ticket_${selectedTicket.id}`;
    const channel = supabase.channel(channelName);

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_messages',
        filter: `ticket_id=eq.${selectedTicket.id}`,
      },
      async (payload) => {
        if (payload.new.user_id === user?.id) return; // Managed by Optimistic UI

        const { data, error } = await supabase
          .from('ticket_messages')
          .select(
            `*, author:profiles!ticket_messages_user_id_fkey (full_name, email, role, avatar_url)`,
          )
          .eq('id', payload.new.id)
          .single();

        if (!error && data) {
          setSelectedTicket((prev) => {
            if (!prev) return prev;
            if (prev.messages?.find((m) => m.id === data.id)) return prev;
            return {
              ...prev,
              messages: [
                ...(prev.messages || []),
                data as unknown as MessageUI,
              ],
            };
          });
          setTimeout(
            () => flatListRef.current?.scrollToEnd({ animated: true }),
            300,
          );
        }
      },
    );

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewMode, selectedTicket?.id, user?.id]);

  // ─── DATA FETCHING ───
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('tickets')
        .select(
          `*, user:profiles!tickets_user_id_fkey (full_name, email, role, avatar_url)`,
        );

      if (!isStaff) {
        query = query.eq('user_id', user.id);
      } else {
        if (filter === 'my_tickets') query = query.eq('user_id', user.id);
        else if (filter === 'queue')
          query = query.in('status', ['open', 'in_progress', 'underreview']);
      }

      const { data, error } = await query;
      if (error) throw error;

      setTickets((data as unknown as TicketUI[]) || []);
    } catch (e: any) {
      console.error('[Support] Load Error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, filter, isStaff]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  // ─── DETERMINISTIC MEMOIZED FILTERING ───
  const displayTickets = useMemo(() => {
    let base = tickets;

    if (search.trim()) {
      const lower = search.toLowerCase();
      base = base.filter(
        (t) =>
          t.subject.toLowerCase().includes(lower) ||
          t.id.toLowerCase().includes(lower),
      );
    }

    return base.sort((a, b) => {
      if (filter === 'queue') {
        const scoreA = a.user?.role === 'premium' ? 1 : 0;
        const scoreB = b.user?.role === 'premium' ? 1 : 0;
        if (scoreA !== scoreB) return scoreB - scoreA; // Premium first
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [search, tickets, filter]);

  // ─── TICKET ACTIONS ───
  const loadTicketDetails = async (ticket: TicketUI) => {
    setSelectedTicket(ticket);
    setViewMode('detail');
    try {
      const { data, error } = await supabase
        .from('ticket_messages')
        .select(
          `*, author:profiles!ticket_messages_user_id_fkey (full_name, email, role, avatar_url)`,
        )
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const transformedMessages = (data as unknown as MessageUI[]).filter(
        (msg) => isStaff || !msg.is_internal,
      );

      setSelectedTicket((prev) =>
        prev ? { ...prev, messages: transformedMessages } : null,
      );
      setTimeout(() => {
        if (flatListRef.current && transformedMessages.length > 0)
          flatListRef.current.scrollToEnd({ animated: true });
      }, 500);
    } catch (e: any) {
      console.error('[Support] Detail Error:', e.message);
    }
  };

  const handleSendMessage = async (isInternal: boolean = false) => {
    const content = isInternal ? internalNote : newMessage;
    if (!content.trim() || !selectedTicket || !user) return;

    // OPTIMISTIC UI: Instantly clear input and push to local state array
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: MessageUI = {
      id: tempId,
      ticket_id: selectedTicket.id,
      user_id: user.id,
      message: content,
      created_at: new Date().toISOString(),
      is_internal: isInternal,
      attachment_url: null,
      author: {
        role: profile?.role || 'member',
        full_name: profile?.full_name || null,
        email: profile?.email || '',
        avatar_url: profile?.avatar_url || null,
      },
    };

    setSelectedTicket((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...(prev.messages || []), optimisticMessage],
      };
    });

    if (isInternal) setInternalNote('');
    else setNewMessage('');

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    // BACKGROUND SYNC
    setIsSubmitting(true);
    try {
      const { data: insertedMessage, error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          message: content,
          is_internal: isInternal,
        })
        .select(
          `*, author:profiles!ticket_messages_user_id_fkey (full_name, email, role, avatar_url)`,
        )
        .single();

      if (error) throw error;

      // Swap temp ID silently
      if (insertedMessage) {
        setSelectedTicket((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages?.map((m) =>
              m.id === tempId ? (insertedMessage as unknown as MessageUI) : m,
            ),
          };
        });
      }
    } catch (e: any) {
      // Revert Optimistic UI on failure
      setSelectedTicket((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages?.filter((m) => m.id !== tempId),
        };
      });
      Alert.alert('Transmission Failed', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newTitle.trim() || !newInitialMsg.trim() || !user)
      return Alert.alert(
        'Validation Error',
        'Please provide a subject and description.',
      );

    setIsSubmitting(true);
    try {
      const { data: ticket, error: tErr } = await supabase
        .from('tickets')
        .insert({
          user_id: user.id,
          subject: newTitle,
          category: newCategory,
          status: 'open',
          priority: profile?.role === 'premium' ? 'high' : 'medium',
        })
        .select()
        .single();
      if (tErr) throw tErr;

      const { error: mErr } = await supabase.from('ticket_messages').insert({
        ticket_id: ticket.id,
        user_id: user.id,
        message: newInitialMsg,
        is_internal: false,
      });
      if (mErr) throw mErr;

      setNewTitle('');
      setNewInitialMsg('');
      setViewMode('list');
      setFilter('my_tickets');
      loadData();
    } catch (e: any) {
      Alert.alert('Creation Failed', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTicket = async (id: string) => {
    if (!isAdmin) return;
    const executeDelete = async () => {
      try {
        const { error } = await supabase.from('tickets').delete().eq('id', id);
        if (error) throw error;
        setViewMode('list');
        loadData();
      } catch (err: any) {
        Alert.alert('Deletion Failed', err.message);
      }
    };

    if (IS_WEB) {
      if (window.confirm('ADMIN ACTION: Permanently delete this ticket?'))
        executeDelete();
    } else {
      Alert.alert(
        'Delete Ticket',
        'ADMIN ACTION: This permanently removes the ticket.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: executeDelete },
        ],
      );
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!selectedTicket || !isStaff) return;
    const { error } = await supabase
      .from('tickets')
      .update({ status: newStatus })
      .eq('id', selectedTicket.id);
    if (error) return Alert.alert('Update Failed', error.message);

    setSelectedTicket((prev) => (prev ? { ...prev, status: newStatus } : null));
    setStatusModalVisible(false);
    loadData();
  };

  // ─── LOCAL RENDER FUNCTIONS ──────────────────────────────────────────────────

  const renderTicketCard = ({
    item,
    index,
  }: {
    item: TicketUI;
    index: number;
  }) => {
    const statusColor = getStatusColor(item.status);
    return (
      <Animated.View entering={FadeInDown.duration(320).delay(index * 40)}>
        <Pressable
          onPress={() => loadTicketDetails(item)}
          style={({ pressed }) => [
            {
              borderWidth: 1,
              borderColor: `${statusColor}30`,
              backgroundColor: `${statusColor}0A`,
              borderRadius: 20,
              padding: 16,
              marginBottom: 12,
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 10,
            }}
          >
            <View style={{ flex: 1, paddingRight: 16 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <MessageSquare size={14} color={C_CYAN} opacity={0.7} />
                <Text
                  numberOfLines={1}
                  style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}
                >
                  {item.subject}
                </Text>
              </View>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <RoleBadge role={item.user?.role} />
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 11,
                    fontWeight: '700',
                  }}
                >
                  {item.user?.full_name || item.user?.email || 'Unknown User'}
                </Text>
              </View>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 10,
                  marginTop: 6,
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                }}
              >
                #{item.id.slice(0, 8)} • {item.category}
              </Text>
            </View>
            <View
              style={{
                padding: 8,
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: 12,
              }}
            >
              <ArrowBigLeftDash size={16} color={statusColor} opacity={0.8} />
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 4,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.05)',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                borderWidth: 1,
                borderColor: statusColor + '32',
                borderRadius: 20,
                paddingHorizontal: 9,
                paddingVertical: 3,
                backgroundColor: statusColor + '10',
              }}
            >
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: statusColor,
                }}
              />
              <Text
                style={{
                  color: statusColor,
                  fontSize: 9,
                  fontWeight: '700',
                  letterSpacing: 1.2,
                }}
              >
                {item.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.26)', fontSize: 11 }}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderChatMessage = ({
    item,
    index,
  }: {
    item: MessageUI;
    index: number;
  }) => {
    const isMe = item.user_id === user?.id;
    const isInternal = item.is_internal;
    const fetchedRole = item.author?.role;
    const fetchedName =
      item.author?.full_name || item.author?.email || 'Unknown User';
    const authorRole = isMe ? profile?.role : fetchedRole;
    const authorName = isMe
      ? profile?.full_name || user?.email || 'You'
      : fetchedName;
    const authorAvatar = isMe ? profile?.avatar_url : item.author?.avatar_url;
    const roleColor = getRoleColor(authorRole);

    const bRad = {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomRightRadius: isMe ? 4 : 20,
      borderBottomLeftRadius: isMe ? 20 : 4,
    };
    const bubbleColor = isInternal
      ? 'rgba(245, 158, 11, 0.15)'
      : isMe
        ? 'rgba(0, 240, 255, 0.1)'
        : `${roleColor}10`;
    const borderColor = isInternal
      ? C_AMBER
      : isMe
        ? 'rgba(0, 240, 255, 0.3)'
        : `${roleColor}30`;

    return (
      <Animated.View
        entering={FadeInUp.delay(index * 50)}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          marginBottom: 24,
          gap: 8,
          justifyContent: isMe ? 'flex-end' : 'flex-start',
          width: '100%',
        }}
      >
        {!isMe && (
          <View style={{ alignItems: 'center' }}>
            {authorAvatar ? (
              <Image
                source={{ uri: authorAvatar }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: roleColor,
                }}
              />
            ) : (
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: `${roleColor}30`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: roleColor,
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 13,
                    textTransform: 'uppercase',
                  }}
                >
                  {authorName[0]}
                </Text>
              </View>
            )}
          </View>
        )}

        <View
          style={{
            flexShrink: 1,
            maxWidth: IS_WEB ? '75%' : '95%',
            alignItems: isMe ? 'flex-end' : 'flex-start',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 6,
              gap: 6,
            }}
          >
            <Text
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 11,
                fontWeight: 'bold',
              }}
              numberOfLines={1}
            >
              {authorName}
            </Text>
            <RoleBadge role={authorRole} />
          </View>

          <View
            style={{
              paddingHorizontal: 14,
              paddingVertical: 12,
              backgroundColor: bubbleColor,
              borderColor: borderColor,
              borderWidth: 1,
              ...bRad,
            }}
          >
            {isInternal && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(245, 158, 11, 0.3)',
                  paddingBottom: 6,
                }}
              >
                <Lock size={12} color={C_AMBER} />
                <Text
                  style={{
                    color: C_AMBER,
                    fontSize: 10,
                    fontWeight: '900',
                    letterSpacing: 1.5,
                  }}
                >
                  INTERNAL NOTE
                </Text>
              </View>
            )}
            <Text
              style={{
                fontSize: 14,
                lineHeight: 22,
                color: isInternal ? '#fef08a' : 'white',
                ...(IS_WEB
                  ? ({ wordBreak: 'break-word', whiteSpace: 'pre-wrap' } as any)
                  : {}),
              }}
            >
              {item.message}
            </Text>
          </View>
        </View>

        {isMe && (
          <View style={{ alignItems: 'center' }}>
            {authorAvatar ? (
              <Image
                source={{ uri: authorAvatar }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(0, 240, 255, 0.5)',
                }}
              />
            ) : (
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(0, 240, 255, 0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(0, 240, 255, 0.5)',
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 13,
                    textTransform: 'uppercase',
                  }}
                >
                  {authorName[0]}
                </Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    );
  };

  // ─── GLOBAL RENDER RETURN ───────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C_APP_BG }}>
      <Stack.Screen
        options={{ headerShown: false, headerTransparent: true, title: '' }}
      />

      {/* STRICT Z-INDEX ARCHITECTURE */}
      <AmbientArchitecture />

      <SafeAreaView
        style={{ flex: 1, zIndex: 10, elevation: 10 }}
        edges={['top']}
      >
        {/* ─── VIEW 1: DETAIL CHAT ─── */}
        {viewMode === 'detail' && selectedTicket && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            style={{ flex: 1 }}
          >
            <View
              style={{
                flex: 1,
                width: '100%',
                maxWidth: 672,
                alignSelf: 'center',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  minHeight: 70,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Pressable
                    onPress={() => setViewMode('list')}
                    style={({ pressed }) => [
                      {
                        padding: 8,
                        marginLeft: -4,
                        marginRight: 8,
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <ArrowBigLeftDash size={24} color={C_CYAN} />
                  </Pressable>

                  <View
                    style={{
                      flexDirection: 'column',
                      justifyContent: 'center',
                      flexShrink: 1,
                    }}
                  >
                    <Text
                      style={{
                        color: 'white',
                        fontWeight: '900',
                        fontSize: 15,
                        marginBottom: 2,
                      }}
                      numberOfLines={1}
                    >
                      {selectedTicket.subject}
                    </Text>
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: 11,
                        fontWeight: '600',
                      }}
                      numberOfLines={1}
                    >
                      By:{' '}
                      {selectedTicket.user?.full_name ||
                        selectedTicket.user?.email ||
                        'Unknown User'}
                    </Text>
                  </View>
                </View>

                {isStaff && (
                  <View style={{ flexShrink: 0, paddingRight: 8 }}>
                    <Pressable
                      onPress={() => setStatusModalVisible(true)}
                      style={({ pressed }) => [
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: getStatusColor(selectedTicket.status),
                          backgroundColor:
                            getStatusColor(selectedTicket.status) + '15',
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: getStatusColor(selectedTicket.status),
                          letterSpacing: 0.5,
                        }}
                      >
                        {selectedTicket.status.toUpperCase().replace('_', ' ')}
                      </Text>
                      <ChevronDown
                        size={14}
                        color={getStatusColor(selectedTicket.status)}
                        style={{ marginLeft: 6 }}
                      />
                    </Pressable>
                  </View>
                )}
                <View style={{ width: 45 }} />
              </View>

              <FlatList
                ref={flatListRef}
                data={selectedTicket.messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{
                  paddingHorizontal: 4,
                  paddingTop: 16,
                  paddingBottom: 40,
                }}
                showsVerticalScrollIndicator={false}
                renderItem={renderChatMessage}
                onContentSizeChange={() =>
                  flatListRef.current?.scrollToEnd({ animated: true })
                }
                keyboardShouldPersistTaps="handled"
              />

              <View
                style={{
                  paddingHorizontal: 12,
                  paddingTop: 12,
                  paddingBottom: bottomChatPadding,
                  backgroundColor: 'transparent',
                  width: '100%',
                  maxWidth: 600,
                  alignSelf: 'center',
                }}
              >
                {isStaff && (
                  <View style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <TextInput
                        style={{
                          flex: 1,
                          backgroundColor: 'rgba(245, 158, 11, 0.05)',
                          color: '#facc15',
                          borderRadius: 20,
                          paddingHorizontal: 16,
                          height: 40,
                          borderWidth: 1,
                          borderColor: 'rgba(245, 158, 11, 0.3)',
                          ...(Platform.OS === 'web'
                            ? ({ outlineStyle: 'none' } as any)
                            : {}),
                        }}
                        placeholder="Add a hidden internal note for staff..."
                        placeholderTextColor="rgba(245, 158, 11, 0.4)"
                        value={internalNote}
                        onChangeText={setInternalNote}
                      />
                      <Pressable
                        onPress={() => handleSendMessage(true)}
                        disabled={!internalNote.trim() || isSubmitting}
                        style={({ pressed }) => [
                          {
                            width: 40,
                            height: 40,
                            backgroundColor: 'rgba(245, 158, 11, 0.05)',
                            borderRadius: 20,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: 'rgba(245, 158, 11, 0.8)',
                            opacity: pressed ? 0.7 : 1,
                            transform: [{ scale: pressed ? 0.95 : 1 }],
                          },
                        ]}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator color={C_AMBER} size="small" />
                        ) : (
                          <Lock size={16} color={C_AMBER} />
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderRadius: 24,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      minHeight: 48,
                      maxHeight: 100,
                      justifyContent: 'center',
                    }}
                  >
                    <TextInput
                      style={{
                        color: 'white',
                        paddingHorizontal: 16,
                        paddingTop: Platform.OS === 'ios' ? 14 : 10,
                        paddingBottom: Platform.OS === 'ios' ? 14 : 10,
                        fontSize: 13,
                        ...(Platform.OS === 'web'
                          ? ({ outlineStyle: 'none' } as any)
                          : {}),
                      }}
                      placeholder="Type a secure message..."
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={newMessage}
                      onChangeText={setNewMessage}
                      multiline
                    />
                  </View>
                  <Pressable
                    disabled={!newMessage.trim() || isSubmitting}
                    onPress={() => handleSendMessage(false)}
                    style={({ pressed }) => [
                      {
                        width: 48,
                        height: 48,
                        backgroundColor: newMessage.trim()
                          ? C_CYAN
                          : 'rgba(255,255,255,0.08)',
                        borderRadius: 24,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: pressed ? 0.8 : 1,
                        transform: [{ scale: pressed ? 0.95 : 1 }],
                      },
                    ]}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color={C_NAVY} size="small" />
                    ) : (
                      <Send
                        size={20}
                        color={
                          newMessage.trim() ? C_NAVY : 'rgba(255,255,255,0.5)'
                        }
                        style={{ marginLeft: newMessage.trim() ? -2 : 0 }}
                      />
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* ─── VIEW 2: CREATE TICKET ─── */}
        {viewMode === 'create' && (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              padding: 20,
              paddingBottom: 100,
              width: '100%',
              maxWidth: 672,
              alignSelf: 'center',
            }}
          >
            <Pressable
              onPress={() => setViewMode('list')}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 16,
                  marginBottom: 16,
                  gap: 8,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <ArrowBigLeftDash size={20} color={C_CYAN} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '900',
                  letterSpacing: 4,
                  color: '#00F0FF',
                  textTransform: 'uppercase',
                }}
              >
                RETURN
              </Text>
            </Pressable>

            <Text
              style={{
                color: 'white',
                fontSize: 32,
                fontWeight: '900',
                marginBottom: 8,
                letterSpacing: -0.5,
              }}
            >
              New Ticket
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 14,
                marginBottom: 32,
              }}
            >
              Our team typically responds within 2 hours.
            </Text>

            <GlassCard
              style={{
                padding: 24,
                borderRadius: 24,
                backgroundColor: 'rgba(255,255,255,0.02)',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <Text
                style={{
                  color: C_CYAN,
                  fontSize: 11,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                  letterSpacing: 1,
                }}
              >
                Subject
              </Text>
              <TextInput
                style={{
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  color: 'white',
                  borderRadius: 16,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  marginBottom: 28,
                  fontSize: 16,
                  ...(Platform.OS === 'web'
                    ? ({ outlineStyle: 'none' } as any)
                    : {}),
                }}
                placeholder="E.g., Missing Transcript"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text
                style={{
                  color: C_CYAN,
                  fontSize: 11,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                  letterSpacing: 1,
                }}
              >
                Category
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 28,
                }}
              >
                {[
                  'Technical Issue',
                  'Account',
                  'Content Request',
                  'Billing',
                ].map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setNewCategory(cat)}
                    style={({ pressed }) => [
                      {
                        paddingHorizontal: 18,
                        paddingVertical: 12,
                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor:
                          newCategory === cat
                            ? C_CYAN
                            : 'rgba(255,255,255,0.1)',
                        backgroundColor:
                          newCategory === cat
                            ? 'rgba(0,240,255,0.1)'
                            : 'rgba(0,0,0,0.3)',
                        opacity: pressed ? 0.7 : 1,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          newCategory === cat
                            ? C_CYAN
                            : 'rgba(255,255,255,0.7)',
                        fontSize: 13,
                        fontWeight: 'bold',
                      }}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text
                style={{
                  color: C_CYAN,
                  fontSize: 11,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                  letterSpacing: 1,
                }}
              >
                Description
              </Text>
              <TextInput
                style={{
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  color: 'white',
                  borderRadius: 16,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  marginBottom: 36,
                  height: 140,
                  textAlignVertical: 'top',
                  fontSize: 16,
                  ...(Platform.OS === 'web'
                    ? ({ outlineStyle: 'none' } as any)
                    : {}),
                }}
                placeholder="Provide detailed information about your issue..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={newInitialMsg}
                onChangeText={setNewInitialMsg}
                multiline
              />

              <PillGlowButton
                title="Submit Secure Ticket"
                onPress={handleCreateTicket}
                isLoading={isSubmitting}
                icon={ShieldCheck}
              />
            </GlassCard>
          </ScrollView>
        )}

        {/* ─── VIEW 3: MAIN TICKET LIST ─── */}
        {viewMode === 'list' && (
          <FlatList
            data={filter === 'faq' ? [] : displayTickets}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              filter === 'faq' ? (
                <View style={{ paddingBottom: 40, marginTop: 10 }}>
                  {FAQ_DATA.map((item, index) => {
                    const IconComponent = item.icon;
                    return (
                      <Animated.View
                        key={item.id}
                        entering={FadeInUp.delay(index * 100).springify()}
                      >
                        <GlassCard
                          style={{
                            padding: 20,
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: 'rgba(255,255,255,0.015)',
                            borderColor: 'rgba(255,255,255,0.05)',
                            borderWidth: 1,
                            marginBottom: 16,
                            borderRadius: 16,
                          }}
                        >
                          <View
                            style={{
                              backgroundColor: item.color + '15',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 48,
                              height: 48,
                              borderRadius: 16,
                              borderWidth: 1,
                              borderColor: 'rgba(255,255,255,0.05)',
                            }}
                          >
                            <IconComponent size={22} color={item.color} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 20 }}>
                            <Text
                              style={{
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: 14,
                                marginBottom: 6,
                              }}
                            >
                              {item.question}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                lineHeight: 20,
                                color: 'rgba(255,255,255,0.5)',
                              }}
                            >
                              {item.answer}
                            </Text>
                          </View>
                        </GlassCard>
                      </Animated.View>
                    );
                  })}
                </View>
              ) : (
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingTop: 80,
                  }}
                >
                  <Text style={{ fontSize: 48, marginBottom: 20 }}>📭</Text>
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: 15,
                      textAlign: 'center',
                      lineHeight: 24,
                    }}
                  >
                    {search
                      ? 'No tickets match this search.'
                      : 'You have no open tickets.'}
                  </Text>
                </View>
              )
            }
            renderItem={renderTicketCard}
            contentContainerStyle={{
              paddingBottom: 100,
              flexGrow: 1,
              width: '100%',
              maxWidth: 672,
              alignSelf: 'center',
              paddingHorizontal: 12,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={C_CYAN}
                colors={[C_CYAN]}
              />
            }
            ListHeaderComponent={
              <View
                style={{
                  paddingTop: 0,
                  paddingBottom: 0,
                  alignItems: 'center',
                }}
              >
                <Animated.View entering={FadeInDown.duration(400)}>
                  <AnimatedSupportIcon />
                </Animated.View>

                {(!isStaff || filter === 'my_tickets') && (
                  <Animated.View
                    entering={FadeInDown.duration(400).delay(100)}
                    style={{ marginTop: 32 }}
                  >
                    <PillGlowButton
                      title="Open New Ticket"
                      onPress={() => setViewMode('create')}
                      icon={Plus}
                    />
                  </Animated.View>
                )}

                {filter !== 'faq' && (
                  <Animated.View
                    entering={FadeInDown.duration(400).delay(300)}
                    style={{ width: '100%', paddingBottom: 20, paddingTop: 32 }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                        borderRadius: 16,
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        paddingHorizontal: 16,
                        paddingVertical: Platform.OS === 'ios' ? 22 : 20,
                        marginBottom: 36,
                      }}
                    >
                      <Search size={18} color="rgba(255,255,255,0.3)" />
                      <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search tickets by ID or Subject..."
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        style={{
                          flex: 1,
                          color: '#FFFFFF',
                          fontSize: 15,
                          ...(Platform.OS === 'web'
                            ? ({ outline: 'none' } as any)
                            : {}),
                        }}
                      />
                      {search.length > 0 && (
                        <Pressable
                          onPress={() => setSearch('')}
                          style={({ pressed }) => [
                            { padding: 4, opacity: pressed ? 0.6 : 1 },
                          ]}
                        >
                          <XCircle size={18} color="rgba(255,255,255,0.4)" />
                        </Pressable>
                      )}
                    </View>
                  </Animated.View>
                )}

                <Animated.View
                  entering={FadeInDown.duration(400).delay(400)}
                  style={{ width: '100%', marginBottom: 16 }}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingRight: 20 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {isStaff && (
                      <FilterChip
                        label="Support Queue"
                        active={filter === 'queue'}
                        onPress={() => setFilter('queue')}
                      />
                    )}
                    {isStaff && (
                      <FilterChip
                        label="All Tickets"
                        active={filter === 'all_tickets'}
                        onPress={() => setFilter('all_tickets')}
                      />
                    )}
                    <FilterChip
                      label="My Tickets"
                      active={filter === 'my_tickets'}
                      onPress={() => setFilter('my_tickets')}
                    />
                    <FilterChip
                      label="Knowledge Base"
                      active={filter === 'faq'}
                      onPress={() => setFilter('faq')}
                    />
                  </ScrollView>
                </Animated.View>
              </View>
            }
          />
        )}
      </SafeAreaView>

      {/* ─── TRUE GLASS MODAL FOR TICKET STATUS ─── */}
      <Modal visible={statusModalVisible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.85)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            zIndex: 100,
          }}
        >
          <GlassCard
            glowColor="cyan"
            style={{
              borderRadius: 32,
              padding: 24,
              borderWidth: 1,
              borderColor: 'rgba(0,240,255,0.2)',
              backgroundColor: 'rgba(2,2,5,0.9)',
              width: '100%',
              maxWidth: 400,
            }}
          >
            <Text
              style={{
                color: 'white',
                fontSize: 18,
                fontWeight: '900',
                marginBottom: 24,
                textAlign: 'center',
                letterSpacing: 1,
              }}
            >
              UPDATE TICKET STATUS
            </Text>

            <View style={{ marginBottom: 10 }}>
              {[
                { key: 'open', label: 'Open' },
                { key: 'in_progress', label: 'In Progress' },
                { key: 'underreview', label: 'Under Review' },
                { key: 'resolved', label: 'Resolved' },
                { key: 'closed', label: 'Closed' },
              ].map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => handleStatusChange(item.key as TicketStatus)}
                  style={({ pressed }) => [
                    {
                      padding: 18,
                      marginBottom: 10,
                      backgroundColor:
                        selectedTicket?.status === item.key
                          ? 'rgba(0,240,255,0.1)'
                          : 'rgba(255,255,255,0.03)',
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor:
                        selectedTicket?.status === item.key
                          ? C_CYAN
                          : 'rgba(255,255,255,0.05)',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: pressed ? 0.7 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        selectedTicket?.status === item.key ? C_CYAN : 'white',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    {item.label}
                  </Text>
                  {selectedTicket?.status === item.key && (
                    <CheckCircle2 size={20} color={C_CYAN} />
                  )}
                </Pressable>
              ))}
            </View>

            {isAdmin && selectedTicket && (
              <Pressable
                onPress={() => {
                  setStatusModalVisible(false);
                  handleDeleteTicket(selectedTicket.id);
                }}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16,
                    marginBottom: 12,
                    marginTop: 16,
                    backgroundColor: '#FF0033',
                    borderRadius: 16,
                    shadowColor: '#FF0033',
                    shadowOpacity: 0.6,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}
              >
                <Trash2 size={20} color="#FFFFFF" />
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginLeft: 8,
                  }}
                >
                  Delete Ticket
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => setStatusModalVisible(false)}
              style={({ pressed }) => [
                {
                  padding: 16,
                  alignItems: 'center',
                  marginTop: 4,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Cancel
              </Text>
            </Pressable>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}
