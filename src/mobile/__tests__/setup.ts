jest.mock('expo-router', () => {
  const React = require('react');
  const { mockRouter } = require('./helpers/mockRouter');
  const passthrough = ({ children }: any) => children ?? null;
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
    Stack: Object.assign(passthrough, { Screen: () => null, Protected: passthrough }),
    Tabs: Object.assign(passthrough, { Screen: () => null }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const make = (name: string) => {
    const C = (props: any) => React.createElement(View, props, props.children);
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: make('Svg'),
    Svg: make('Svg'),
    Path: make('Path'),
    Line: make('Line'),
    Defs: make('Defs'),
    LinearGradient: make('LinearGradient'),
    Stop: make('Stop'),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);