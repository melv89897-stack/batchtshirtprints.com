import js from '@eslint/js';
import react from 'eslint-plugin-react';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'data/**', 'public/tools/**', 'master-security-template/**'] },
  js.configs.recommended,
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    rules: {
      ...react.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
    settings: { react: { version: 'detect' } },
  },
];
