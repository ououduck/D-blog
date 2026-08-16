import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * ESLint 9 flat config。
 *
 * 规则取舍：
 * - typescript-eslint recommended：基础推荐规则（覆盖 no-unused-vars、
 *   no-explicit-any 等），不启用 type-checked 变体（避免要求 project 配置）。
 * - react-hooks recommended：含 exhaustive-deps（v7 的 recommended 即最新推荐集）。
 * - react-refresh only-export-components：warn 级别，允许常量导出；仅作用于 .tsx，
 *   入口/SSR/上下文等不参与 Fast Refresh 的文件单独关闭。
 * - eslint-config-prettier 置于末尾：关闭与 Prettier 冲突的格式类规则，
 *   代码风格统一交给 Prettier 负责。
 */
export default tseslint.config(
  {
    ignores: [
      // 构建产物与生成数据
      'dist/',
      'dist-ssr/',
      'generated/',
      'coverage/',
      'public/',
      // 依赖与本地工具目录
      'node_modules/',
      'dsh-plugins/',
      '.zcode/',
      '.trash/',
      '.vscode/',
      '*.local',
      '.dsh-*.cjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // 代码库约定：对象 rest 解构中刻意忽略的键（如 { searchText, ...post }）与
    // _ 前缀变量（如 _savedAt）不算未使用；destructuring 剥离字段的场景很常见。
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['buildSiteSchemas'] },
      ],
    },
  },
  {
    // 客户端/SSR 入口与上下文文件不参与 Fast Refresh，关闭 react-refresh 告警。
    files: ['src/index.tsx', 'src/ssr-entry.tsx', 'src/ssr/**', 'src/components/ReadingModeContext.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  eslintConfigPrettier,
);
