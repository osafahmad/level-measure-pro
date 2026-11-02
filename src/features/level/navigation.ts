import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type LevelStackParamList = {
  Level: undefined;
  Calibrate: undefined;
  Readings: undefined;
  Settings: undefined;
};

export type LevelScreenProps<T extends keyof LevelStackParamList> = NativeStackScreenProps<LevelStackParamList, T>;
