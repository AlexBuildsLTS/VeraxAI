/**
 * components/ui/ProfileDropdown.tsx
 * User context menu — avatar trigger with floating dropdown.
 * Shows full name, email, dynamic role badge, and navigation actions.
 * Platform-safe: uses native shadow props (not NativeWind) for glow effects.
 * WebkitBackdropFilter applied conditionally for web blur support.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

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

/** Returns color tokens for each user role. */
const getRoleConfig = (role?: string) => {
  switch (role?.toLowerCase()) {
    case 'admin':
      return {
        label: 'ADMIN',
        bg: 'rgba(255,51,102,0.15)',
        text: '#FF3366',
        border: 'rgba(255,51,102,0.3)',
        shadow: '#FF3366',
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
    router.push(path as any);
  };

  return (
    <View
      style={{ position: 'relative', alignItems: 'flex-end', zIndex: 9999 }}
    >
      {/* Avatar trigger button */}
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        className="w-10 h-10 rounded-full bg-[#020205] border border-white/10 items-center justify-center"
        style={{
          ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
          shadowColor: roleConfig.shadow,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 10,
          elevation: 5,
        }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: '100%', height: '100%', borderRadius: 20 }}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={{
              color: roleConfig.text,
              fontFamily: Platform.OS === 'web' ? 'monospace' : 'Menlo',
              fontSize: 13,
              fontWeight: '900',
            }}
          >
            {getInitials(fullName)}
          </Text>
        )}
      </TouchableOpacity>

      {/* Floating dropdown menu */}
      {isOpen && (
        <>
          {/* Invisible backdrop to close dropdown when tapping outside */}
          <TouchableOpacity
            style={{ position: 'fixed' as any, inset: 0, zIndex: 9998 }}
            onPress={() => setIsOpen(false)}
            activeOpacity={1}
          />

          <View
            className="absolute top-14 right-0 w-60 rounded-2xl bg-[#0A0D14]/95 border border-white/10 overflow-hidden"
            style={{
              zIndex: 9999,
              ...(Platform.OS === 'web'
                ? { WebkitBackdropFilter: 'blur(20px) saturate(180%)' as any }
                : {}),
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 1,
              shadowRadius: 20,
              elevation: 15,
            }}
          >
            {/* User info header */}
            <View
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.05)',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontWeight: '800',
                    fontSize: 13,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {fullName}
                </Text>
                {/* Role badge */}
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
                      fontSize: 8,
                      fontWeight: '900',
                      letterSpacing: 1,
                    }}
                  >
                    {roleConfig.label}
                  </Text>
                </View>
              </View>
              <Text
                style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                numberOfLines={1}
              >
                {email}
              </Text>
            </View>

            {/* Navigation actions */}
            <View style={{ padding: 8 }}>
              {userRole === 'admin' && (
                <TouchableOpacity
                  onPress={() => handleNavigate('/admin')}
                  activeOpacity={0.7}
                  className="flex-row items-center p-3 rounded-xl"
                  style={{ backgroundColor: 'rgba(255,51,102,0.05)' }}
                >
                  <Text
                    style={{
                      color: '#FF3366',
                      fontSize: 11,
                      fontWeight: '800',
                      letterSpacing: 1,
                    }}
                  >
                    🛡️ ADMIN
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => handleNavigate('/settings')}
                activeOpacity={0.7}
                className="flex-row items-center p-3 rounded-xl"
              >
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1,
                  }}
                >
                  ⚙️ SETTINGS
                </Text>
              </TouchableOpacity>

              <View
                style={{
                  height: 1,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  marginVertical: 4,
                }}
              />

              <TouchableOpacity
                onPress={handleSignOut}
                activeOpacity={0.7}
                className="flex-row items-center p-3 rounded-xl"
              >
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1,
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
