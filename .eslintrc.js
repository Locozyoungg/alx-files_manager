module.exports = {
    env: {
      browser: true,
      es2021: true,
      node: true,
      mocha: true
    },
    extends: [
      'eslint:recommended',
      'plugin:node/recommended'
    ],
    parserOptions: {
      ecmaVersion: 12,
      sourceType: 'module'
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  };
  