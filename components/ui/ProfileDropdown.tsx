/**
 * components/ui/ProfileDropdown.tsx
 * VeraxAI — User Profile Menu (dropdown)
 * ══════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE
 * REANIMATED PHYSICS: Menu enters with a fluid, spring-physics drop-down animation
 * Native scrollbar hiding for Web, maintaining fluid wheel/touch scroll
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  Image,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '../../store/useAuthStore';
import {
  DatabaseZap,
  ShieldCheck,
  Component,
  LogOut,
  LucideIcon,
  ShieldPlus,
  Database,
  DatabaseBackup,
  Wrench,
  Info,
  Spline,
  Shield,
  Cpu,
  User,
} from 'lucide-react-native';

// ─── STRICT THEME CONSTANTS ──────────────────────────────────────────────────
const THEME = {
  obsidian: '#050B14',
  admin: '#8A2BE2', // Neon Purple
  support: '#00F0FF', // Cyan
  premium: '#F59E0B', // Amber
  member: '#3B82F6', // Electric Neon Blue
  danger: '#FF3366', // Rose/Pink
};

const IS_WEB = Platform.OS === 'web';

// ─── UTILITIES ───────────────────────────────────────────────────────────────

/** Extracts 2 intials from username */
const getInitials = (name?: string | null): string => {
  if (!name) return 'U';
  return name
    .trim()
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

/** Returns Liquid Neon color tokens strictly mapped to User Roles. */
const getRoleConfig = (role?: string | null) => {
  switch (role?.toLowerCase()) {
    case 'admin':
      return {
        color: THEME.admin,
        bg: 'rgba(138,43,226,0.15)',
        label: 'ADMIN',
      };
    case 'support':
      return {
        color: THEME.support,
        bg: 'rgba(0,240,255,0.15)',
        label: 'SUPPORT',
      };
    case 'premium':
      return {
        color: THEME.premium,
        bg: 'rgba(245,158,11,0.15)',
        label: 'PREMIUM',
      };
    case 'member':
    default:
      return {
        color: THEME.member,
        bg: 'rgba(59,130,246,0.15)',
        label: 'MEMBER',
      };
  }
};

// ─── REUSABLE SUB-COMPONENTS ─────────────────────────────────────────────────

interface DropdownItemProps {
  icon: LucideIcon;
  label: string;
  color?: string;
  bgColor?: string;
  onPress: () => void;
  isDanger?: boolean;
}

/**
 * Ensures consistent padding, typography, and touch physics across all options.
 */
const DropdownItem = React.memo(
  ({
    icon: Icon,
    label,
    color = '#00F0FF',
    bgColor,
    onPress,
    isDanger,
  }: DropdownItemProps) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      delayPressIn={0} // CRITICAL: 0ms latency for Android APK
      className="flex-row items-center p-3.5 mb-1 rounded-xl transition-colors hover:bg-white/5"
      style={bgColor ? { backgroundColor: bgColor } : {}}
    >
      <Icon
        size={16}
        color={isDanger ? THEME.danger : color}
        style={{ marginRight: 14 }}
      />
      <Text
        style={{
          color: isDanger ? THEME.danger : '#fefefe',
          fontSize: 11,
          fontWeight: '900',
          letterSpacing: 1.5,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  ),
);
DropdownItem.displayName = 'DropdownItem';

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export const ProfileDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { profile, signOut } = useAuthStore();
  const router = useRouter();

  const handleSignOut = useCallback(async () => {
    setIsOpen(false);
    await signOut();
    router.replace('/(auth)/sign-in');
  }, [signOut, router]);

  const handleNavigation = useCallback(
    (path: any) => {
      setIsOpen(false);
      router.push(path);
    },
    [router],
  );

  const roleConfig = getRoleConfig(profile?.role);
  const initials = getInitials(profile?.full_name || profile?.email);

  return (
    <View style={{ zIndex: 1000 }}>
      {/* ── AVATAR TRIGGER BUTTON ── */}
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.8}
        delayPressIn={0}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: THEME.obsidian,
          borderWidth: 2,
          borderColor: roleConfig.color,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          ...(IS_WEB
            ? ({ boxShadow: `0 0 15px ${roleConfig.color}60` } as any)
            : {
                shadowColor: roleConfig.color,
                shadowOpacity: 0.6,
                shadowRadius: 12,
              }),
        }}
      >
        {profile?.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Text
            style={{ color: roleConfig.color, fontSize: 16, fontWeight: '900' }}
          >
            {initials}
          </Text>
        )}
      </TouchableOpacity>

      {/* ── DROPDOWN MENU (Animated) ── */}
      {isOpen && (
        <>
          {/* Invisible Overlay: Closes dropdown when tapping outside */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            className="fixed inset-0 z-[999]"
            onPress={() => setIsOpen(false)}
            activeOpacity={1}
            delayPressIn={0}
          />

          <Animated.View
            entering={FadeInDown.duration(400).springify()}
            style={{
              position: 'absolute',
              top: 56,
              right: 0,
              width: 260,
              backgroundColor: 'rgba(5, 11, 20, 0.95)',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.08)',
              zIndex: 1000,
              padding: 16,
              ...(IS_WEB
                ? ({
                    boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                  } as any)
                : {
                    shadowColor: '#000',
                    shadowOpacity: 0.8,
                    shadowRadius: 20,
                    elevation: 15,
                  }),
            }}
          >
            {/* Header: User Info & Explicit Badge */}
            <View style={{ marginBottom: 16, paddingHorizontal: 4 }}>
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: 16,
                  fontWeight: '900',
                  marginBottom: 4,
                }}
                numberOfLines={1}
              >
                {profile?.full_name || 'Anonymous User'}
              </Text>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  marginBottom: 10,
                }}
                numberOfLines={1}
              >
                {profile?.email}
              </Text>

              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: roleConfig.bg,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: roleConfig.color + '50',
                }}
              >
                <Text
                  style={{
                    color: roleConfig.color,
                    fontSize: 9,
                    fontWeight: '900',
                    letterSpacing: 1.5,
                  }}
                >
                  {roleConfig.label}
                </Text>
              </View>
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.06)',
                marginBottom: 12,
              }}
            />

            {/* Scrollable Actions */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.hiddenScrollbar}
              keyboardShouldPersistTaps="always"
            >
              <DropdownItem
                icon={User}
                label="PROFILE"
                onPress={() => handleNavigation('/settings/profile')}
              />
              <DropdownItem
                icon={Cpu}
                label="LLM MODELS"
                onPress={() => handleNavigation('/settings/models')}
              />
              <DropdownItem
                icon={DatabaseBackup}
                label="SETTINGS"
                onPress={() => handleNavigation('/settings')}
              />

              {profile?.role === 'admin' && (
                <>
                  <View
                    style={{
                      height: 1,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      marginVertical: 6,
                    }}
                  />
                  <DropdownItem
                    icon={DatabaseZap}
                    label="ADMIN CORE"
                    color="#cf023f"
                    onPress={() => handleNavigation('/admin')}
                  />
                </>
              )}

              <View
                style={{
                  height: 1,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  marginVertical: 6,
                }}
              />

              <DropdownItem
                icon={LogOut}
                label="SIGN OUT"
                isDanger={true}
                bgColor="rgba(255,51,102,0.05)"
                onPress={handleSignOut}
              />
            </ScrollView>
          </Animated.View>
        </>
      )}
    </View>
  );
};

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  hiddenScrollbar: {
    ...(IS_WEB
      ? ({ scrollbarWidth: 'none', msOverflowStyle: 'none' } as any)
      : {}),
  },
});
