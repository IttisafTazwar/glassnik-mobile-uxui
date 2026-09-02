import React from 'react';
import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { TopNav } from '@/components/TopNav';
import { Sidebar } from '@/components/Sidebar';

const MOBILE_BREAKPOINT = 768;

interface DesktopAppShellProps {
  children: React.ReactNode;
}

export function DesktopAppShell({ children }: DesktopAppShellProps) {
  const { width } = useWindowDimensions();

  const useDesktopShell =
    Platform.OS === 'web' && width >= MOBILE_BREAKPOINT;

  if (!useDesktopShell) {
    return <>{children}</>;
  }

  return (
    <View style={styles.screen}>
      <TopNav />

      <View style={styles.pageRow}>
        <Sidebar />

        <View style={styles.content}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },

  pageRow: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },

  content: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    backgroundColor: '#000',
  },
});
