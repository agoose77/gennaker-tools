import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import { includeIgnoreFile } from '@eslint/compat';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import jupyterPlugin from '@jupyter/eslint-plugin';
//
// eslint-disable-next-line no-undef
const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url));
export default defineConfig([
  includeIgnoreFile(gitignorePath, { gitignoreResolution: true }),
  {
    ignores: [
      'node_modules',
      'dist',
      'coverage',
      '**/*.js',
      '**/*.d.ts',
      '.venv',
      'tests',
      '**/__tests__',
      'ui-tests'
    ]
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  jupyterPlugin.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      jupyter: jupyterPlugin
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2015,
        ...globals.node
      },
      parserOptions: {
        project: 'tsconfig.json',
        sourceType: 'module'
      }
    },
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: {
            regex: '^I[A-Z]',
            match: true
          }
        }
      ],
      '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/quotes': [
        'error',
        'single',
        { avoidEscape: true, allowTemplateLiterals: false }
      ],
      curly: ['error', 'all'],
      eqeqeq: 'error',
      'prefer-arrow-callback': 'error'
    }
  },
  prettierRecommended
]);
