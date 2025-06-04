const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');

module.exports = [
    // Global ignores
    {
        ignores: ['out/**', 'dist/**', '**/*.d.ts', 'node_modules/**', 'coverage/**'],
    },
    
    // Base JavaScript configuration
    js.configs.recommended,
    
    // TypeScript configuration
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: 'module',
                project: './tsconfig.json',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            // Style rules
            'curly': 'warn',
            'eqeqeq': 'warn',
            'no-throw-literal': 'warn',
            'semi': 'off',
            
            // Disable rules that TypeScript handles better
            'no-unused-vars': 'off',
            'no-undef': 'off',
            
            // TypeScript-specific rules
            '@typescript-eslint/no-unused-vars': ['warn', { 
                'argsIgnorePattern': '^_',
                'varsIgnorePattern': '^_' 
            }],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
        },
    },
];
