import { Stack } from 'expo-router';

// Explore is its own small stack, so each pill click (?destination=... or
// ?place=...) becomes a separate history entry. That is what makes the
// browser Back button return to the previous pill.
export default function ExploreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}