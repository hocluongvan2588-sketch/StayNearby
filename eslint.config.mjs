import { dirname } from 'path';
import { fileURLToPath } from 'url';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: ['.next/**', 'node_modules/**', '.data/**', 'coverage/**'],
  },
  {
    settings: {
      next: {
        rootDir: __dirname,
      },
    },
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
];

export default eslintConfig;
