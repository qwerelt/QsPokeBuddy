import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

interface BottomNavBarProps {
  currentTab?: 'pet' | 'log' | 'inventory' | 'todo' | 'pokemon';
}

export default function BottomNavBar({ currentTab }: BottomNavBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isTab = (tabName: string) => {
    if (currentTab) return currentTab === tabName;
    if (tabName === 'pet') return pathname === '/pet' || pathname === '/';
    if (tabName === 'log') return pathname === '/log';
    if (tabName === 'inventory') return pathname === '/inventory';
    if (tabName === 'todo') return pathname === '/todo';
    if (tabName === 'pokemon') return pathname === '/pokemon';
    return false;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.navItem, isTab('log') && styles.navItemActive]}
        onPress={() => router.push('/log' as any)}
        activeOpacity={0.7}>
        <Text style={[styles.navIcon, isTab('log') && styles.navIconActive]}>📝</Text>
        <Text style={[styles.navLabel, isTab('log') && styles.navLabelActive]} numberOfLines={1}>
          Log activity
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, isTab('inventory') && styles.navItemActive]}
        onPress={() => router.push('/inventory' as any)}
        activeOpacity={0.7}>
        <Text style={[styles.navIcon, isTab('inventory') && styles.navIconActive]}>🎒</Text>
        <Text style={[styles.navLabel, isTab('inventory') && styles.navLabelActive]} numberOfLines={1}>
          Inventory
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, isTab('todo') && styles.navItemActive]}
        onPress={() => router.push('/todo' as any)}
        activeOpacity={0.7}>
        <Text style={[styles.navIcon, isTab('todo') && styles.navIconActive]}>✅</Text>
        <Text style={[styles.navLabel, isTab('todo') && styles.navLabelActive]} numberOfLines={1}>
          ToDo
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, isTab('pokemon') && styles.navItemActive]}
        onPress={() => router.push('/pokemon' as any)}
        activeOpacity={0.7}>
        <Text style={[styles.navIcon, isTab('pokemon') && styles.navIconActive]}>⚡</Text>
        <Text style={[styles.navLabel, isTab('pokemon') && styles.navLabelActive]} numberOfLines={1}>
          Pokemon
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#0f380f',
    borderTopWidth: 3,
    borderTopColor: '#306230',
    paddingBottom: 10,
    paddingTop: 6,
    paddingHorizontal: 4,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    marginHorizontal: 2,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: '#306230',
    borderWidth: 1,
    borderColor: '#8bac0f',
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  navIconActive: {
    transform: [{ scale: 1.15 }],
  },
  navLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#8bac0f',
    textTransform: 'uppercase',
  },
  navLabelActive: {
    color: '#9bbc0f',
    fontWeight: '900',
  },
});
