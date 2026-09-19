import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

export type ModerationAction = 'APPROVE' | 'REJECT' | 'REMOVE' | 'SHADOW_BAN' | 'AGE_RESTRICT';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (action: ModerationAction, reason?: string) => void;
  submitting?: boolean;
}

const ACTIONS: { action: ModerationAction; label: string; icon: React.ComponentProps<typeof Feather>['name']; color: string; requiresReason?: boolean }[] = [
  { action: 'APPROVE', label: 'Approve', icon: 'check-circle', color: '#10B981' },
  { action: 'REJECT', label: 'Reject', icon: 'x-circle', color: '#ef4444', requiresReason: true },
  { action: 'REMOVE', label: 'Remove', icon: 'trash-2', color: '#ef4444', requiresReason: true },
  { action: 'SHADOW_BAN', label: 'Shadow Ban', icon: 'eye-off', color: '#F59E0B', requiresReason: true },
  { action: 'AGE_RESTRICT', label: 'Age Restrict', icon: 'alert-triangle', color: '#F59E0B', requiresReason: true },
];

export function ModerationActionModal({ visible, onClose, onSubmit, submitting }: Props) {
  const [selected, setSelected] = useState<ModerationAction | null>(null);
  const [reason, setReason] = useState('');

  function reset() {
    setSelected(null);
    setReason('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleConfirm() {
    if (!selected) return;
    onSubmit(selected, reason.trim() || undefined);
  }

  const selectedMeta = ACTIONS.find((a) => a.action === selected);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Moderate video</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Feather name="x" size={22} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            <View style={styles.actionsGrid}>
              {ACTIONS.map((a) => {
                const isSelected = selected === a.action;
                return (
                  <Pressable
                    key={a.action}
                    style={[styles.actionBtn, isSelected && { borderColor: a.color, backgroundColor: `${a.color}22` }]}
                    onPress={() => setSelected(a.action)}
                  >
                    <Feather name={a.icon} size={18} color={a.color} />
                    <Text style={styles.actionLabel}>{a.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {selected && (
              <View style={styles.reasonBlock}>
                <Text style={styles.reasonLabel}>
                  Reason{selectedMeta?.requiresReason ? ' (recommended)' : ' (optional)'}
                </Text>
                <TextInput
                  style={styles.reasonInput}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Add a note for this decision…"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  multiline
                />
              </View>
            )}
          </ScrollView>

          <Pressable
            style={[styles.confirmBtn, (!selected || submitting) && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!selected || submitting}
          >
            <Text style={styles.confirmBtnText}>
              {submitting ? 'Submitting…' : selected ? `Confirm ${selectedMeta?.label}` : 'Select an action'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#121214',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  actionLabel: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  reasonBlock: { marginTop: 16, gap: 6 },
  reasonLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Inter_500Medium' },
  reasonInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 12,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  confirmBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: '#000', fontSize: 15, fontFamily: 'Inter_700Bold' },
});