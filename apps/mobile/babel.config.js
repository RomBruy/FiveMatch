module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'react-native-css-interop' }],
    ],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@fivematch/types': '../../packages/types/src',
            '@fivematch/api-client': '../../packages/api-client/src',
            '~': '.',
          },
        },
      ],
      require('react-native-css-interop/dist/babel-plugin').default,
      'react-native-reanimated/plugin', // must be last
    ],
  }
}
