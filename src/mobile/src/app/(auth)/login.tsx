import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField, TextInputHandle } from '@/components/ui/TextField';
import { useAuth } from '@/providers/AuthProvider';
import { AuthError } from '@/services';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { UserRole } from '@/types/models';


type Mode = 'login' | 'signup';
type Errors = Partial<Record<'displayName' | 'email' | 'password', string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(mode: Mode, v: { displayName: string; email: string; password: string }): Errors {
  const e: Errors = {};
  if (mode === 'signup' && v.displayName.trim().length < 2) {
    e.displayName = 'Display name must be at least 2 characters.';
  }
  if (!EMAIL_RE.test(v.email.trim())) e.email = 'Enter a valid email address.';
  if (v.password.length < 8) e.password = 'Password must be at least 8 characters.';
  return e;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<UserRole>('listener');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailRef = useRef<TextInputHandle>(null);
  const passwordRef = useRef<TextInputHandle>(null);
  const isSignUp = mode === 'signup';

  const switchMode = (m: Mode) => {
    setMode(m);
    setErrors({});
    setFormError(null);
  };

  const submit = async () => {
    const found = validate(mode, { displayName, email, password });
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const creds = { email: email.trim(), password };
      if (isSignUp) await signUp({ ...creds, displayName: displayName.trim(), role });
      else await login(creds);
      // On success the Stack.Protected guard in the root layout switches to (tabs).
    } catch (err) {
      setFormError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoGlyph}>♪</Text>
          </View>
          <Text style={styles.brand}>Interlude</Text>
          <Text style={styles.tagline}>Discover music. Listen together.</Text>
        </View>

        <SegmentedControl
          value={mode}
          onChange={switchMode}
          options={[
            { value: 'login', label: 'Log in' },
            { value: 'signup', label: 'Sign up' },
          ]}
        />

        <View style={styles.form}>
          {isSignUp && (
            <TextField
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              error={errors.displayName}
              placeholder="How others will see you"
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          )}

          <TextField
            inputRef={emailRef}
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <TextField
            inputRef={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            placeholder="At least 8 characters"
            secureTextEntry
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            returnKeyType="done"
            onSubmitEditing={submit}
          />

          {isSignUp && (
            <View style={styles.roleBlock}>
              <Text style={styles.roleLabel}>I want to join as</Text>
              <SegmentedControl
                value={role}
                onChange={setRole}
                options={[
                  { value: 'listener', label: 'Listener' },
                  { value: 'musician', label: 'Musician' },
                ]}
              />
            </View>
          )}

          {!!formError && (
            <View style={styles.formError}>
              <Text style={styles.formErrorText}>{formError}</Text>
            </View>
          )}

          <Button
            title={isSignUp ? 'Create account' : 'Log in'}
            onPress={submit}
            loading={submitting}
          />
        </View>

        <Text style={styles.switchText}>
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <Text style={styles.switchLink} onPress={() => switchMode(isSignUp ? 'login' : 'signup')}>
            {isSignUp ? 'Log in' : 'Sign up'}
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, gap: spacing.xl },
  header: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoGlyph: { fontSize: 32, color: colors.onPrimary },
  brand: { ...typography.display, color: colors.textPrimary },
  tagline: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.lg },
  roleBlock: { gap: spacing.sm },
  roleLabel: { ...typography.label, color: colors.textSecondary },
  formError: {
    backgroundColor: colors.dangerSurface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  formErrorText: { ...typography.body, color: colors.danger },
  switchText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  switchLink: { color: colors.accent, fontWeight: '600' },
});