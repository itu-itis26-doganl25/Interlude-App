import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { usePlayer } from '@/providers/PlayerProvider';

export function PlayerControls() {
  const { isPlaying, shuffle, repeat, toggle, next, previous, toggleShuffle, cycleRepeat } =
    usePlayer();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Shuffle"
        accessibilityState={{ selected: shuffle }}
        onPress={toggleShuffle}
        hitSlop={8}
      >
        <Ionicons name="shuffle" size={24} color={shuffle ? colors.primary : colors.textMuted} />
      </Pressable>

      <Pressable accessibilityRole="button" accessibilityLabel="Previous" onPress={previous} hitSlop={8}>
        <Ionicons name="play-skip-back" size={30} color={colors.textPrimary} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        onPress={toggle}
        style={styles.playButton}
      >
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color={colors.onPrimary} />
      </Pressable>

      <Pressable accessibilityRole="button" accessibilityLabel="Next" onPress={next} hitSlop={8}>
        <Ionicons name="play-skip-forward" size={30} color={colors.textPrimary} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Repeat ${repeat}`}
        onPress={cycleRepeat}
        hitSlop={8}
      >
        <Ionicons name="repeat" size={24} color={repeat === 'off' ? colors.textMuted : colors.primary} />
        {repeat === 'one' ? <Text style={styles.repeatOne}>1</Text> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatOne: {
    position: 'absolute',
    top: -4,
    right: -6,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
});
