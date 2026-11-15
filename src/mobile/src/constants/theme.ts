import { Platform, TextStyle } from 'react-native';

export const colors = {
  background: '#0B0B0F',
  surface: '#15151C',
  surfaceElevated: '#1E1E28',
  border: '#2A2A36',

  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3C2',
  textMuted: '#6E6E80',

  primary: '#8B5CF6',
  primaryPressed: '#7444E0',
  onPrimary: '#FFFFFF',
  accent: '#22D3EE',

  danger: '#F87171',
  dangerSurface: 'rgba(248,113,113,0.12)',
  success: '#4ADE80',

  overlay: 'rgba(0,0,0,0.6)',
  transparent: 'transparent',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

const fontFamily = Platform.select({ ios: 'System', default: 'sans-serif' });

export const typography = {
  display: { fontFamily, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontFamily, fontSize: 22, fontWeight: '700' },
  subtitle: { fontFamily, fontSize: 17, fontWeight: '600' },
  body: { fontFamily, fontSize: 15, fontWeight: '400' },
  label: { fontFamily, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  caption: { fontFamily, fontSize: 12, fontWeight: '400' },
} satisfies Record<string, TextStyle>;

export const theme = { colors, spacing, radius, typography } as const;
export type Theme = typeof theme;