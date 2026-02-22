import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const { register, isLoading, error, clearError } = useAuthStore();

  const displayError = localError || error;

  const validate = (): string | null => {
    if (name.trim().length < 2) return 'Name must be at least 2 characters';
    if (!email.trim().includes('@')) return 'Enter a valid email address';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  const handleRegister = async () => {
    setLocalError('');
    const validationError = validate();
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      router.replace('/(app)');
    } catch {
      // Error set in store
    }
  };

  const dismissError = () => {
    setLocalError('');
    clearError();
  };

  const isFormFilled = name && email && password && confirmPassword;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>⚡ WebForge</Text>
          <Text style={styles.tagline}>Enterprise AI Website Builder</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Create your account</Text>

          {displayError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{displayError}</Text>
              <TouchableOpacity onPress={dismissError} hitSlop={8}>
                <Text style={styles.errorDismiss}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Jane Smith"
            placeholderTextColor="#334155"
            autoComplete="name"
            returnKeyType="next"
          />

          <Text style={styles.label}>Work Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor="#334155"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="next"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Minimum 8 characters"
            placeholderTextColor="#334155"
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="next"
          />

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat your password"
            placeholderTextColor="#334155"
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />

          <TouchableOpacity
            style={[styles.submitBtn, (!isFormFilled || isLoading) && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={!isFormFilled || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.terms}>
            By creating an account you agree to our Terms of Service and Privacy Policy.
          </Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" style={styles.footerLink}>
              Sign in
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F14' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 },

  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 30, fontWeight: '800', color: '#818CF8', letterSpacing: -0.5 },
  tagline: { color: '#475569', fontSize: 13, marginTop: 4 },

  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  title: { color: '#F1F5F9', fontSize: 20, fontWeight: '700', marginBottom: 20 },

  label: { color: '#64748B', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: '#0D1117',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#F1F5F9',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#1E293B',
  },

  submitBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  submitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.45 },

  errorBanner: {
    backgroundColor: '#2D1010',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  errorText: { color: '#FCA5A5', fontSize: 13, flex: 1 },
  errorDismiss: { color: '#F87171', fontSize: 16, paddingLeft: 8 },

  terms: { color: '#334155', fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  footerText: { color: '#475569', fontSize: 14 },
  footerLink: { color: '#818CF8', fontSize: 14, fontWeight: '600' },
});
