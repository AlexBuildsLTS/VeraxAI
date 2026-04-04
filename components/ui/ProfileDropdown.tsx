import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';




const getInitials = (name?: string) => {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

export const ProfileDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const fullName = user?.user_metadata?.full_name || 'Operator';
  const email = user?.email || '';

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  return (
    <View style={{ position: 'relative', alignItems: 'flex-end', zIndex: 999 }}>
      {/* Avatar button */}
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 1.5,
          borderColor: 'rgba(0,240,255,0.4)',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
          ...(Platform.OS === 'web'
            ? ({
                boxShadow: '0 0 15px rgba(0,240,255,0.2)',
              } as any)
            : {}),
        }}
      >
        <Text
          style={{
            color: '#00F0FF',
            fontFamily: 'monospace',
            fontSize: 16,
            fontWeight: '900',
          }}
        >
          {getInitials(fullName)}
        </Text>
      </TouchableOpacity>

      {/* Dropdown */}
      {isOpen && (
        <View
          style={{
            position: 'absolute',
            top: 52,
            right: 0,
            width: 240,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(2,2,5,0.92)',
            overflow: 'hidden',
            ...(Platform.OS === 'web'
              ? ({
                  backdropFilter: 'blur(40px)',
                  boxShadow:
                    '0 8px 40px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.1)',
                } as any)
              : {}),
          }}
        >
          {/* User info */}
          <View
            style={{
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.05)',
            }}
          >
            <Text
              style={{
                color: '#ffffff',
                fontWeight: '900',
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
              numberOfLines={1}
            >
              {fullName}
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.35)',
                fontSize: 10,
                fontFamily: 'monospace',
                marginTop: 3,
              }}
              numberOfLines={1}
            >
              {email}
            </Text>
          </View>

          {/* Settings link */}
          <TouchableOpacity
            onPress={() => {
              router.push('/settings');
              setIsOpen(false);
            }}
            style={{
              margin: 10,
              padding: 12,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 10,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              ⚙ Settings
            </Text>
          </TouchableOpacity>

          {/* Sign out */}
          <TouchableOpacity
            onPress={handleSignOut}
            style={{
              margin: 10,
              marginTop: 0,
              padding: 13,
              borderRadius: 12,
              backgroundColor: 'rgba(255,0,127,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(255,0,127,0.2)',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: '#FF007F',
                fontSize: 9,
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: 3,
              }}
            >
              SIGN OUT
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};
