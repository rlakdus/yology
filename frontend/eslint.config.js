import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // react-three-fiber의 useFrame은 매 프레임 three.js 객체를 직접 변형하는 것이
    // 설계 그 자체다. 카메라 회전, 머티리얼 opacity, texture.needsUpdate 같은 조작은
    // React state로 옮길 수 없고 옮겨서도 안 된다(프레임마다 리렌더가 된다).
    // 그래서 VR 모듈에 한해 명령형 변형을 막는 두 규칙만 끈다.
    files: ['src/components/vr/**/*.{ts,tsx}', 'src/vr/**/*.{ts,tsx}', 'src/pages/VrScene.tsx'],
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
    },
  },
])
