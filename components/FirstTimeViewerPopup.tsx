import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface Props {
  onDismiss: () => void;
}

// First-time-viewer explainer for the For You page — shown once, ever,
// per device (gated by AsyncStorage in index.tsx). Explains that Place/
// Destination/Category under each video are tap targets for exploring
// related content, not just decorative labels. Per spec: Place and
// Destination aren't wired to anything yet (next development stage) —
// only Category actually navigates anywhere right now.
export function FirstTimeViewerPopup({ onDismiss }: Props) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Explore your way</Text>
          <Pressable onPress={onDismiss} hitSlop={10}>
            <Feather name="x" size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>

        <Text style={styles.body}>
          Swipe up to watch the next video, or{' '}
          <Text style={styles.bodyBold}>at any time</Text>, tap the place,
          destination or category below a video to explore more videos
          related to that topic.
        </Text>

        <View style={styles.divider} />

        <View style={styles.columnsRow}>
          <View style={styles.column}>
            <Text style={styles.columnLabel}>Place</Text>
            <Text style={styles.columnSub}>More from{'\n'}this place</Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.columnLabel}>Destination</Text>
            <Text style={styles.columnSub}>More from{'\n'}this destination</Text>
          </View>
          <View style={styles.column}>
            <View style={styles.categoryBadge}>
              <Text style={styles.columnLabelCategory}>CATEGORY</Text>
            </View>
            <Text style={styles.columnSub}>More in{'\n'}this category</Text>
          </View>
        </View>

        <Pressable style={styles.gotItBtn} onPress={onDismiss}>
          <Text style={styles.gotItText}>Got it!</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 50,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(20,20,22,0.97)',
    borderRadius: 20,
    padding: 22,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#fff', fontSize: 19, fontFamily: 'Inter_700Bold' },
  body: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    textAlign: 'center',
  },
  bodyBold: { fontFamily: 'Inter_700Bold', color: '#fff' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.15)' },
  columnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: { flex: 1, alignItems: 'center', gap: 6 },
  columnLabel: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  categoryBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  columnLabelCategory: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  columnSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 15,
  },
  gotItBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  gotItText: { color: '#000', fontSize: 15, fontFamily: 'Inter_700Bold' },
});