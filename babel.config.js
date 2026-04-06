module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@/components': './src/components',
            '@/screens': './src/screens',
            '@/services': './src/services',
            '@/hooks': './src/hooks',
            '@/utils': './src/utils',
            '@/constants': './src/constants',
            '@/store': './src/store',
            '@/types': './src/types',
          },
        },
      ],

      // ⭐ MUST BE LAST — Reanimated plugin must always be last
      'react-native-reanimated/plugin',
    ],
  };
};
