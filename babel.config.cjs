/**
 * babel.config.cjs
 * VeraxAI Core: NativeWind v4 & Production Hardening
 */
module.exports = function (api) {
  // Cache the configuration based on the environment (development vs production)
  api.cache.using(() => process.env.NODE_ENV);

  const isProd = api.env('production');

  // Base plugins required for VeraxAI architecture
  const plugins = ['react-native-reanimated/plugin'];

  // STRATEGIC INJECTION: Strip all console logs ONLY in production.
  // We preserve 'error' and 'warn' for catastrophic crash reporting via Sentry/Crashlytics if added later.
  if (isProd) {
    plugins.push(['transform-remove-console', { exclude: ['error', 'warn'] }]);
  }

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
    plugins: plugins,
  };
};
