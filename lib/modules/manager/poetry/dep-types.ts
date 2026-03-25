import type { DepTypeMetadata } from '../types.ts';

/**
 * poetry depTypes are partially dynamic: group names from
 * `[tool.poetry.group.<name>.dependencies]` become depTypes at runtime.
 * The values below cover all known/common depTypes.
 */
export const knownDepTypes = [
  {
    depType: 'dependencies',
    description: 'Listed under `[tool.poetry.dependencies]`',
  },
  {
    depType: 'dev-dependencies',
    description: 'Listed under `[tool.poetry.dev-dependencies]`',
  },
  {
    depType: 'extras',
    description: 'An optional dependency marked with `optional = true`',
  },
  {
    depType: 'build-system.requires',
    description: 'Listed under `[build-system.requires]`',
  },
  {
    depType: 'project.dependencies',
    description: 'Listed under `[project.dependencies]` (PEP 621 style)',
  },
  {
    depType: 'project.optional-dependencies',
    description:
      'Listed under `[project.optional-dependencies]` (PEP 621 style)',
  },
  {
    depType: 'dependency-groups',
    description: 'Listed under `[dependency-groups]` (PEP 735)',
  },
] as const satisfies readonly DepTypeMetadata[];

export const supportsDynamicDepTypesNote =
  'Dependency group names from `[tool.poetry.group.<name>.dependencies]` are also used as `depType` values.';
