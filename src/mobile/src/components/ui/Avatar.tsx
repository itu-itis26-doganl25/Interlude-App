import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { artworkPalette, colors, typography } from '@/constants/theme';

interface Props {
  uri: string | null;
  name: string;
  seed: string;
  size: number;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ uri, name, seed, size }: Props) {
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (uri) return <Image source={{ uri }} style={box} contentFit="cover" />;

  return (
    <View style={[box, styles.placeholder, { backgroundColor: artworkPalette[hash(seed) % artworkPalette.length] }]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initial: { ...typography.subtitle, color: colors.textPrimary },
});