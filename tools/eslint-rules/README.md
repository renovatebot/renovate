# Custom ESLint Rules

This directory contains custom ESLint rules specific to the Renovate codebase.

## Available Rules

### `no-repo-in-logger`

Enforces using `repository` instead of `repo` in logger structured parameters for consistency.

**Rationale:** The codebase should use `repository` consistently in structured logging to maintain clear, searchable logs.

#### ❌ Bad

```typescript
logger.debug({ repo, other }, 'message');
logger.info({ repo: value }, 'message');
logger.warn({ repo }, 'Loading repo data');
logger.once.error({ repo: name }, 'Failed');
```

#### ✅ Good

```typescript
logger.debug({ repository, other }, 'message');
logger.info({ repository: value }, 'message');
logger.warn({ repository }, 'Loading repository data');
logger.once.error({ repository: name }, 'Failed');

// Also acceptable - different property name with repo as value
logger.debug({ repositoryDetails: repo }, 'Repository details');
logger.debug({ gitlabRepo: repo }, 'GitLab repo data');
```

#### Autofix

This rule supports autofixing. Run:

```bash
npm run eslint-fix
```

Or for a specific file:

```bash
npx eslint --fix path/to/file.ts
```

## Usage

The rules are automatically loaded in `eslint.config.mjs` and applied to all TypeScript and JavaScript files in the project.

To disable a rule for a specific line:

```typescript
// eslint-disable-next-line local-rules/no-repo-in-logger
logger.debug({ repo }, 'message');
```

## Testing Rules

To test the rule on specific files:

```bash
# Check for violations
npx eslint lib/path/to/file.ts --no-ignore

# Check and autofix
npx eslint lib/path/to/file.ts --no-ignore --fix
```
