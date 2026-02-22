import React, { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../../types';
import { ChatBubble } from './ChatBubble';

interface Props {
  messages: ChatMessage[];
  /** Bottom padding so messages aren't hidden behind the floating input */
  bottomPadding?: number;
}

/**
 * ChatList renders the full conversation thread.
 *
 * Auto-scrolls to the bottom:
 * - When a new message is added (messages.length increases)
 * - As streaming text arrives (last message content grows)
 *
 * We use a FlatList (not ScrollView) for performance on long histories.
 */
export function ChatList({ messages, bottomPadding = 0 }: Props) {
  const listRef = useRef<FlatList>(null);
  const lastContentLength = useRef(0);

  const lastMessage = messages[messages.length - 1];
  const lastContentLen = lastMessage?.content?.length ?? 0;

  useEffect(() => {
    // Scroll when content grows (streaming) or a new message arrives
    if (lastContentLen !== lastContentLength.current || messages.length > 0) {
      lastContentLength.current = lastContentLen;
      // Small delay lets React finish the render before scrolling
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 30);
    }
  }, [messages.length, lastContentLen]);

  if (messages.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="chatbubble-outline" size={32} color="#334155" style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>Start building</Text>
        <Text style={styles.emptyText}>
          Describe the website you want to create, or tell me what to change.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ChatBubble message={item} />}
      style={styles.list}
      contentContainerStyle={[styles.content, { paddingBottom: 12 + bottomPadding }]}
      showsVerticalScrollIndicator={false}
      // Prevent the list from stealing keyboard focus from the input
      keyboardShouldPersistTaps="handled"
      // Keep the list scrolled to the bottom as new items render
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#0F0F14' },
  content: { paddingVertical: 12 },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#0F0F14',
  },
  emptyIcon: { marginBottom: 12 },
  emptyTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '600', marginBottom: 8 },
  emptyText: { color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
