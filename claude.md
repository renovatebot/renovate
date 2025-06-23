# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Renovate is an automated dependency update tool that creates pull requests to update dependencies across 90+ package managers. It follows a plugin-based architecture with clear separation between datasources (where to find packages), managers (how to parse/update files), and platforms (where to create PRs).

## Common Development Commands

```bash
# Install dependencies
pnpm install

# Run full test suite (required before commits)
pnpm test

# Run unit tests only
pnpm vitest

# Run unit tests for a specific file
pnpm vitest lib/modules/versioning/n-minus-one/index.spec.ts

# Run tests in watch mode
pnpm vitest --watch

# Fix linting issues
pnpm lint-fix

# Build the project
pnpm build

# Run Renovate locally
pnpm start
```

## Architecture Overview

### Module System

Renovate uses a plugin architecture with three main module types:

1. **Datasources** (`lib/modules/datasource/`): Fetch package versions from registries

   - Each datasource implements `getReleases()` to return available versions
   - Common pattern: parse registry responses, map to `ReleaseResult`

2. **Managers** (`lib/modules/manager/`): Parse and update dependency files

   - Each manager implements `extractPackageFile()` and `updateArtifacts()`
   - Handles file parsing, dependency extraction, and file updates

3. **Versioning** (`lib/modules/versioning/`): Compare and sort versions
   - Each scheme implements comparison logic for different version formats
   - Key methods: `isValid()`, `isGreaterThan()`, `isStable()`

### Key Patterns

- **Configuration**: Extensive config system with migrations for backwards compatibility
- **Testing**: 100% coverage required, use `.spec.ts` files alongside implementation
- **Error Handling**: Use logger for errors, avoid throwing in datasources
- **Caching**: Built-in caching system for HTTP requests and package lookups
- **Validation**: Zod schemas for external API responses and configuration

### Adding New Features

When implementing new versioning schemes, datasources, or managers:

1. Follow existing patterns in the respective module directory
2. Implement all required interface methods
3. Add comprehensive tests with 100% coverage
4. Update relevant documentation in `docs/usage/`
5. Add to module exports and registration

### Testing Tips

- Use snapshot testing for complex outputs
- Mock HTTP calls with `httpMock` from test utilities
- Test edge cases and error scenarios
- For datasources, test pagination and error handling
- For managers, test various file formats and edge cases
- For versioning, test comparison logic thoroughly

### Current Branch Context

The `feat_support_n_minus_one_versions` branch is implementing n-1 versioning support, which allows specifying versions relative to the latest (e.g., "latest-1" for the previous version).
