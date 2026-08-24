import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

const FOOTER_LINKS = [
  { label: 'Company', icon: 'briefcase' as const, url: 'https://www.glassnik.com/company' },
  { label: 'Terms and Policies', icon: 'shield' as const, url: 'https://www.glassnik.com/terms' },
  { label: 'Support', icon: 'help-circle' as const, url: 'https://www.glassnik.com/support' },
];

export function FooterMenu() {
  return (
    <View style={styles.wrap}>
      {FOOTER_LINKS.map((link) => (
        <Pressable
          key={link.label}
          style={styles.row}
          onPress={() => Linking.openURL(link.url)}
        >
          <Feather name={link.icon} size={14} color="rgba(255,255,255,0.5)" />
          <Text style={styles.linkText}>{link.label}</Text>
        </Pressable>
      ))}
      <Text style={styles.copyright}>© 2026 Glassnik</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  copyright: { color: 'rgba(255,255,255,0.25)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
});