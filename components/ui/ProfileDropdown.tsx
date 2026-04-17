/**
 * components/ui/ProfileDropdown.tsx
 * VeraxAI — Enterprise User Context Menu
 * ══════════════════════════════════════════════════════════════════════════════
 * MODULE OVERVIEW:
 * - AVATAR TRIGGER: Dynamic initials fallback with platform-safe shadow glow.
 * - DROPDOWN MENU: WebkitBackdropFilter blur applied for Web, strict elevation for APK.
 * - NAVIGATION: Reordered to Settings -> Support -> Admin -> Sign Out.
 * - ICONOGRAPHY: Lucide icons placed strictly BEFORE text for optimal UX scanning.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import {
  DatabaseZap,
  ShieldPlus,
  Component,
  ShieldAlert,
  ShieldCheck,
  ScanEye,
  LogOut,
} from 'lucide-react-native';

// ─── UTILITIES ───────────────────────────────────────────────────────────────

/** Extracts up to 2 initials from a display name. */
const getInitials = (name?: string): string => {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

/** Returns Liquid Neon color tokens for each user role. */
const getRoleConfig = (role?: string) => {
  switch (role?.toLowerCase()) {
    case 'admin':
      return {
        label: 'ADMIN',
        bg: 'rgba(255,51,102,0.15)',
        text: '#fefefe', // Inherited brand color for Admin text
        border: 'rgba(133, 4, 36,0.3)',
        shadow: '#30010d',
      };
    case 'support':
      return {
        label: 'SUPPORT',
        bg: 'rgba(59, 21, 140,0.35)',
        text: '#01754d',
        border: 'rgba(59, 21, 140,0.33)',
        shadow: '#260026',
      };
    case 'premium':
      return {
        label: 'PREMIUM',
        bg: 'rgba(255,170,0,0.15)',
        text: '#FFD700',
        border: 'rgba(255,170,0,0.3)',
        shadow: '#FFD700',
      };
    default:
      return {
        label: 'MEMBER',
        bg: 'rgba(0,240,255,0.15)',
        text: '#00F0FF',
        border: 'rgba(0,240,255,0.3)',
        shadow: '#00F0FF',
      };
  }
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export const ProfileDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { user, profile, signOut } = useAuthStore();

  const fullName =
    user?.user_metadata?.full_name || profile?.full_name || 'Operator';
  const email = user?.email || '';
  const avatarUrl =
    user?.user_metadata?.avatar_url || profile?.avatar_url || null;
  const userRole = profile?.role || 'member';
  const roleConfig = getRoleConfig(userRole);

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    // Cast to never to strictly bypass dynamic route linting without using 'any'
    router.push(path as never);
  };

  return (
    <View
      style={{ position: 'relative', alignItems: 'flex-end', zIndex: 9999 }}
    >
      {/* ── AVATAR TRIGGER BUTTON ── */}
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        className="w-10 h-10 rounded-full bg-[#010127e1] border border-white/60 items-center justify-center"
        style={{
          // Safely apply web-only cursor
          ...(Platform.OS === 'web' ? { cursor: 'pointer' as never } : {}),
          shadowColor: roleConfig.shadow,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
          elevation: 5,
        }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: '100%', height: '100%', borderRadius: 45 }}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={{
              color: roleConfig.text,
              fontFamily: Platform.OS === 'web' ? 'monospace' : 'Menlo',
              fontSize: 16,
              fontWeight: '900',
            }}
          >
            {getInitials(fullName)}
          </Text>
        )}
      </TouchableOpacity>

      {/* ── FLOATING DROPDOWN MENU ── */}
      {isOpen && (
        <>
          {/* Invisible backdrop to catch outside taps and close menu */}
          <TouchableOpacity
            style={{ position: 'fixed' as never, inset: 0, zIndex: 9998 }}
            onPress={() => setIsOpen(false)}
            activeOpacity={1}
          />

          <View
            className="absolute top-14 right-0 w-60 rounded-2xl bg-[#0A0D14]/80 border border-blue/20 overflow-hidden"
            style={{
              zIndex: 9999,
              ...(Platform.OS === 'web'
                ? { WebkitBackdropFilter: 'blur(20px) saturate(180%)' as never }
                : {}),
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 1,
              shadowRadius: 20,
              elevation: 25,
            }}
          >
            {/* 1. USER IDENTITY HEADER */}
            <View
              style={{
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.02)',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontWeight: '900',
                    fontSize: 12,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {fullName}
                </Text>
                {/* Dynamic Role Badge */}
                <View
                  style={{
                    backgroundColor: roleConfig.bg,
                    borderColor: roleConfig.border,
                    borderWidth: 1,
                    paddingHorizontal: 6,
                    paddingVertical: 3,
                    borderRadius: 6,
                    marginLeft: 8,
                  }}
                >
                  <Text
                    style={{
                      color: roleConfig.text,
                      fontSize: 10,
                      fontWeight: '900',
                      letterSpacing: 1,
                    }}
                  >
                    {roleConfig.label}
                  </Text>
                </View>
              </View>
              <Text
                style={{ color: 'rgba(117, 180, 250,0.9)', fontSize: 13 }}
                numberOfLines={1}
              >
                {email}
              </Text>
            </View>

            {/* 2. NAVIGATION ACTIONS LIST */}
            <View style={{ padding: 10, gap: 4 }}>
              {/* Settings Action */}
              <TouchableOpacity
                onPress={() => handleNavigate('/settings')}
                activeOpacity={0.7}
                className="flex-row items-center p-3 transition-colors rounded-xl"
                style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
              >
                <ScanEye
                  size={16}
                  color="rgba(2, 207, 128,0.8)"
                  style={{ marginRight: 12 }}
                />
                <Text
                  style={{
                    color: 'rgba(254, 254, 254,0.8)',
                    fontSize: 12,
                    fontWeight: '700',
                    letterSpacing: 1,
                  }}
                >
                  SETTINGS
                </Text>
              </TouchableOpacity>

              {/* Support Action */}
              <TouchableOpacity
                onPress={() => handleNavigate('/settings/support')}
                activeOpacity={0.7}
                className="flex-row items-center p-3 transition-colors rounded-xl"
                style={{ backgroundColor: 'transparent' }}
              >
                <ShieldPlus
                  size={16}
                  color="rgba(2, 146, 207,0.8)"
                  style={{ marginRight: 12 }}
                />
                <Text
                  style={{
                    color: 'rgba(254, 254, 254,0.8)',
                    fontSize: 12,
                    fontWeight: '700',
                    letterSpacing: 1,
                  }}
                >
                  SUPPORT
                </Text>
              </TouchableOpacity>

              <View
                style={{
                  height: 1,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  marginVertical: 4,
                }}
              />

              {/* Admin Action (Conditional) */}
              {userRole === 'admin' && (
                <>
                  <TouchableOpacity
                    onPress={() => handleNavigate('/admin')}
                    activeOpacity={0.8}
                    className="flex-row items-center p-3 rounded-xl"
                    style={{ backgroundColor: 'rgba(31, 49, 87,0.15)' }}
                  >
                    <DatabaseZap
                      size={16}
                      color="#cf023f"
                      style={{ marginRight: 12 }}
                    />
                    <Text
                      style={{
                        color: '#fefefe',
                        fontSize: 12,
                        fontWeight: '900',
                        letterSpacing: 1,
                      }}
                    >
                      ADMIN
                    </Text>
                  </TouchableOpacity>
                  <View
                    style={{
                      height: 1,
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      marginVertical: 4,
                    }}
                  />
                </>
              )}

              {/* Sign Out Action */}
              <TouchableOpacity
                onPress={handleSignOut}
                activeOpacity={0.7}
                className="flex-row items-center p-3 rounded-xl"
                style={{ backgroundColor: 'rgba(255,51,102,0.05)' }}
              >
                <LogOut size={16} color="#FF3366" style={{ marginRight: 12 }} />
                <Text
                  style={{
                    color: '#FF3366',
                    fontSize: 12,
                    fontWeight: '800',
                    letterSpacing: 2,
                  }}
                >
                  SIGN OUT
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </View>
  );
};
