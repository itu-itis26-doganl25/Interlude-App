import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { artworkPalette, colors, radius } from '@/constants/theme';

interface Props {
  uri: string | null;
  seed: string; // placeholder rengini belirler
  size: number;
  round?: boolean;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Artwork({ uri, seed, size, round }: Props) {
  const borderRadius = round ? size / 2 : radius.sm;
  const box = { width: size, height: size, borderRadius };

  if (uri) return <Image source={{ uri }} style={box} contentFit="cover" />;

  return (
    <View style={[box, styles.placeholder, { backgroundColor: artworkPalette[hash(seed) % artworkPalette.length] }]}>
      <Text style={[styles.glyph, { fontSize: size * 0.4 }]}>♪</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  glyph: { color: colors.textPrimary, opacity: 0.8 },
});