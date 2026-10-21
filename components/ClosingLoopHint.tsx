import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';

// Shown once per device, the first time someone opens the video feed.
// It teaches the Place / Destination / Category links without adding
// permanent instructions to the viewing screen.
const STORAGE_KEY = 'glassnik_closing_loop_hint_seen_v1';

// Wait a moment so the video starts first. On a first visit the
// "What is Glassnik?" popup sits on top of this until it is closed.
const SHOW_DELAY_MS = 2000;

export function ClosingLoopHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!mounted || value === 'true') return;
        timer = setTimeout(() => {
          if (mounted) setVisible(true);
        }, SHOW_DELAY_MS);
      })
      .catch(() => {
        // If storage can't be read, skip the hint rather than risk showing
        // it on every visit.
      });

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(STORAGE_KEY, 'true').catch(() => {});
  };

  if (!visible) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={dismiss}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel="Dismiss tip"
      >
        <Feather name="compass" size={18} color="#5eead4" />
        <Text style={styles.text}>
          Tap the <Text style={styles.bold}>Place</Text>,{' '}
          <Text style={styles.bold}>Destination</Text> or{' '}
          <Text style={styles.bold}>Category</Text> shown with a video to
          discover related experiences.
        </Text>
        <Text style={styles.gotIt}>Got it</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 150,
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 50,
  },
  card: {
    maxWidth: 340,
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
  },
  bold: { fontFamily: 'Inter_700Bold', color: '#5eead4' },
  gotIt: {
    alignSelf: 'flex-end',
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});