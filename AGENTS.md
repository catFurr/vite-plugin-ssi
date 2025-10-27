# Development Guidelines for Vite SSI Plugin

## 🔧 Build & Test Commands

- Build: `bun run build`
- Test: `bun test`
- Single Test: `bun test tests/specific-test.test.ts`
- Watch Mode: `bun test --watch`
- Lint: `bun run lint`

## 🧩 Code Style Guidelines

1. Use TypeScript with strict type checking
2. Prefer named exports over default exports
3. Naming Conventions:
   - camelCase for variables and functions
   - PascalCase for types and classes
   - UPPER_SNAKE_CASE for constants

## 🏗️ Import & Module Guidelines

- Use ES Module imports (`import`)
- Organize imports: external libs → local modules → types
- Avoid circular dependencies

## 🚨 Error Handling

- Use custom error classes
- Provide clear, actionable error messages
- Log errors with context
- Prefer throwing errors over silent failures

## 📝 Commit Guidelines

- Descriptive, concise commit messages
- Use conventional commits (feat:, fix:, docs:, etc.)
- Link to issue numbers when applicable

## ✅ Code Quality

- 100% test coverage for core functionality
- No `any` types
- Use ESLint and Prettier for consistency
- Document public APIs with JSDoc

## 📦 Publishing

- Supports ESM and CommonJS
- Minimum Node.js version: 18
- Publish to npm and JSR
