import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/constants/theme';

interface SeekBarProps {
  positionMs: number;
  durationMs: number;
  onSeek: (positionMs: number) => void;
}

const STEP_MS = 10_000;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function SeekBar({ positionMs, durationMs, onSeek }: SeekBarProps) {
  const [dragMs, setDragMs] = useState<number | null>(null);
  const widthRef = useRef(0);
  const startXRef = useRef(0);
  const dragRef = useRef<number | null>(null);
  const durationRef = useRef(durationMs);
  const onSeekRef = useRef(onSeek);
  durationRef.current = durationMs;
  onSeekRef.current = onSeek;

  const pan = useMemo(() => {
    const msAt = (x: number) => {
      const width = widthRef.current;
      if (width <= 0) return 0;
      return Math.round(clamp(x / width, 0, 1) * durationRef.current);
    };
    const setDrag = (ms: number | null) => {
      dragRef.current = ms;
      setDragMs(ms);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        startXRef.current = event.nativeEvent.locationX;
        setDrag(msAt(startXRef.current));
      },
      onPanResponderMove: (_event, gesture) => setDrag(msAt(startXRef.current + gesture.dx)),
      onPanResponderRelease: () => {
        const target = dragRef.current;
        setDrag(null);
        if (target !== null) onSeekRef.current(target);
      },
      onPanResponderTerminate: () => setDrag(null),
    });
  }, []);

  const shown = dragMs ?? positionMs;
  const fraction = durationMs > 0 ? clamp(shown / durationMs, 0, 1) : 0;

  return (
    <View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Seek"
        accessibilityValue={{ min: 0, max: durationMs, now: Math.round(shown) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const { actionName } = event.nativeEvent;
          if (actionName === 'increment') onSeek(clamp(positionMs + STEP_MS, 0, durationMs));
          if (actionName === 'decrement') onSeek(clamp(positionMs - STEP_MS, 0, durationMs));
        }}
        onLayout={(event) => {
          widthRef.current = event.nativeEvent.layout.width;
        }}
        style={styles.hitArea}
        {...pan.panHandlers}
      >
        <View pointerEvents="none" style={styles.track}>
          <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
        </View>
        <View pointerEvents="none" style={[styles.thumb, { left: `${fraction * 100}%` }]} />
      </View>
      <View style={styles.times}>
        <Text style={styles.time}>{formatClock(shown)}</Text>
        <Text style={styles.time}>{`-${formatClock(durationMs - shown)}`}</Text>
      </View>
    </View>
  );
}

const THUMB = 14;

const styles = StyleSheet.create({
  hitArea: { height: 28, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    marginLeft: -THUMB / 2,
    borderRadius: THUMB / 2,
    backgroundColor: colors.textPrimary,
  },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { ...typography.caption, color: colors.textMuted },
});
