import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { ChatMessage } from '../../types';

interface Props {
  message: ChatMessage;
}

/**
 * ChatBubble renders a single message in the conversation.
 *
 * User messages appear right-aligned with an indigo background.
 * Assistant messages appear left-aligned with a dark card style.
 *
 * While a message is streaming (isStreaming=true), a blinking
 * cursor is shown at the end of the content to indicate live output.
 */
export function ChatBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  // Blinking cursor animation — only active while streaming
  useEffect(() => {
    if (!message.isStreaming) {
      cursorOpacity.setValue(0);
      return;
    }

    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(cursorOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [message.isStreaming, cursorOpacity]);

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
          {message.content || (message.isStreaming ? '' : '_Empty response_')}
        </Text>
        {message.isStreaming && (
          <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}>
            ▊
          </Animated.Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    paddingHorizontal: 12,
    gap: 8,
  },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#312E81',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  avatarText: { color: '#A5B4FC', fontSize: 9, fontWeight: '700' },

  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  bubbleUser: {
    backgroundColor: '#4F46E5',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },

  text: { fontSize: 14, lineHeight: 21, flexShrink: 1 },
  textUser: { color: '#EDE9FE' },
  textAssistant: { color: '#E2E8F0' },

  cursor: { color: '#818CF8', fontSize: 14, marginLeft: 1 },
});
