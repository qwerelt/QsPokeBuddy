import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Layout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="pet" />
      <Stack.Screen name="log" />
      <Stack.Screen name="inventory" />
      <Stack.Screen name="todo" />
      <Stack.Screen name="pokemon" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
