import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
    },
    resolve: {
        // Resolve .js extensions to .ts files (TypeScript ESM pattern)
        conditions: ['node'],
    },
});
