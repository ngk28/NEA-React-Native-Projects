import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { RouteProvider } from '@/contexts/RouteContext';
import { useColorScheme } from '@/hooks/use-color-scheme';



export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <RouteProvider> {/* Provides route context to all tabs */}
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
        }}>

        <Tabs.Screen
          name="index"
          options={{
            title: 'Search',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: 'Map',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="map.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="disruption"
          options={{
            title: 'Disruptions',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="exclamationmark.triangle.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="recent"
          options={{
            title: 'Recent',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="clock.fill" color={color} />,
          }}
        />
      </Tabs>
    </RouteProvider>
  );
}
