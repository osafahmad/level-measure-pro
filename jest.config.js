module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    // Reanimated 4.7's native initializer calls a CSS hook the JS (Jest) module rejects; only
    // react-native-reanimated imports a bare './initializers', so use its web variant in tests.
    '^\\./initializers$': '<rootDir>/node_modules/react-native-reanimated/src/initializers.ts',
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*|@sayem314|lucide-react-native)/)',
  ],
};
