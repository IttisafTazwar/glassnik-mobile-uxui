import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';

const STORAGE_KEY = 'glassnik_what_is_glassnik_seen_v1';

export function WhatIsGlassnikModal() {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);
  const { width, height } = useWindowDimensions();

  const isMobile = width < 768;

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!mounted) return;

        if (value !== 'true') {
          setVisible(true);
        }
      })
      .finally(() => {
        if (mounted) setChecked(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const dismiss = async () => {
    setVisible(false);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // The popup can still be dismissed for the current visit.
    }
  };

  if (!checked) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
    >
      <View
        style={[
          styles.backdrop,
          isMobile && styles.mobileBackdrop,
        ]}
      >
        <View
          style={[
            styles.card,
            isMobile ? styles.mobileCard : styles.desktopCard,
            {
              maxHeight: Math.max(520, height - (isMobile ? 32 : 64)),
            },
          ]}
        >
          <Pressable
            onPress={dismiss}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Feather name="x" size={isMobile ? 30 : 34} color="#FFFFFF" />
          </Pressable>

          <Image
            source={require('../assets/images/logo.png')}
            style={[
              styles.logo,
              isMobile && styles.mobileLogo,
            ]}
            resizeMode="contain"
          />

          <Text style={[styles.title, isMobile && styles.mobileTitle]}>
            What is Glassnik?
          </Text>

          <Text
            style={[
              styles.body,
              styles.introBody,
              isMobile && styles.mobileBody,
            ]}
          >
            Glassnik is a new way to explore and share videos.
          </Text>

          <Text style={[styles.body, isMobile && styles.mobileBody]}>
            Glassnik only shows videos recorded from the tiny cameras in
            smart-glasses frames because seeing the world through someone
            else’s eyes, and experiencing the places they go, and the things
            they do, is extraordinary.
          </Text>

          <View style={styles.divider} />

          <Text style={[styles.exploreTitle, isMobile && styles.mobileExploreTitle]}>
            Explore <Text style={styles.cyanText}>your way</Text>
          </Text>

          <Text style={[styles.body, isMobile && styles.mobileBody]}>
            Swipe up to watch the next video. Or at any time, tap the place,
            destination or category links below each video to explore similar
            experiences.
          </Text>

          <Pressable
            onPress={dismiss}
            style={({ pressed }) => [
              styles.gotItButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={[styles.gotItText, isMobile && styles.mobileGotItText]}>
              Got it!
            </Text>
          </Pressable>

          <Text style={[styles.tagline, isMobile && styles.mobileTagline]}>
            REAL PLACES. REAL PEOPLE.{' '}
            <Text style={styles.cyanText}>REAL EXPERIENCES.</Text>
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  mobileBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },

  introBody: {
    marginBottom: 16,
  },

  card: {
    width: '100%',
    backgroundColor: 'rgba(5, 26, 28, 0.96)',
    borderWidth: 2,
    borderColor: '#12DCE5',
    borderRadius: 28,
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingTop: 24,
    paddingBottom: 22,

    ...Platform.select({
      web: {
        boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
      } as any,
      default: {},
    }),
  },

  desktopCard: {
    maxWidth: 650,
  },

  mobileCard: {
    maxWidth: 520,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 24,
  },

  closeButton: {
    position: 'absolute',
    right: 22,
    top: 20,
    zIndex: 5,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logo: {
    width: 82,
    height: 82,
    marginBottom: 6,
  },

  mobileLogo: {
    width: 82,
    height: 82,
    marginBottom: 8,
  },

  title: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 38,
    lineHeight: 45,
    textAlign: 'center',
    marginBottom: 16,
  },

  mobileTitle: {
    fontSize: 32,
    lineHeight: 38,
    marginBottom: 16,
  },

  body: {
    color: '#D6DADD',
    fontFamily: 'Inter_400Regular',
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    maxWidth: 610,
  },

  mobileBody: {
    fontSize: 16,
    lineHeight: 24,
  },

  divider: {
    height: 2,
    width: '100%',
    backgroundColor: '#12DCE5',
    marginVertical: 20,
  },

  exploreTitle: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 29,
    lineHeight: 36,
    textAlign: 'center',
    marginBottom: 12,
  },

  mobileExploreTitle: {
    fontSize: 27,
    lineHeight: 34,
    marginBottom: 14,
  },

  cyanText: {
    color: '#12DCE5',
  },

  gotItButton: {
    width: '100%',
    minHeight: 58,
    borderRadius: 22,
    backgroundColor: '#12DCE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 18,
  },

  pressed: {
    opacity: 0.85,
  },

  gotItText: {
    color: '#041719',
    fontFamily: 'Inter_700Bold',
    fontSize: 25,
  },

  mobileGotItText: {
    fontSize: 25,
  },

  tagline: {
    color: '#D6DADD',
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    letterSpacing: 2.2,
    textAlign: 'center',
  },

  mobileTagline: {
    fontSize: 10,
    letterSpacing: 1.4,
  },
});
