import React, { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '@/constants/theme';

interface Props {
  data: number[];
  height?: number;
}

export function LineChart({ data, height = 160 }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const pad = 6;
  const max = Math.max(...data, 1);
  const x = (i: number) => (data.length < 2 ? width / 2 : (i / (data.length - 1)) * width);
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);

  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && data.length > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity={0.35} />
              <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0.25, 0.5, 0.75].map((t) => (
            <Line key={t} x1={0} x2={width} y1={height * t} y2={height * t} stroke={colors.border} strokeWidth={1} />
          ))}
          <Path d={area} fill="url(#areaFill)" />
          <Path
            d={line}
            stroke={colors.primary}
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      )}
    </View>
  );
}