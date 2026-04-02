/**
 * babel.config.js
 * Corrected structure for NativeWind v4.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxImportSource: 'nativewind',
          unstable_transformImportMeta: true,
        },
      ],
      'nativewind/babel',
    ],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};