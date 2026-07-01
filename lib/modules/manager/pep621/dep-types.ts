import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'requires-python',
    description: 'The `requires-python` constraint from `[project]`',
  },
  {
    depType: 'project.dependencies',
    description: 'Listed under `[project.dependencies]`',
  },
  {
    depType: 'project.optional-dependencies',
    description: 'Listed under `[project.optional-dependencies]`',
  },
  {
    depType: 'dependency-groups',
    description: 'Listed under `[dependency-groups]` (PEP 735)',
  },
  {
    depType: 'build-system.requires',
    description: 'Listed under `[build-system.requires]`',
  },
  {
    depType: 'tool.pdm.dev-dependencies',
    description: 'Listed under `[tool.pdm.dev-dependencies]`',
  },
  {
    depType: 'tool.uv.dev-dependencies',
    description: 'Listed under `[tool.uv.dev-dependencies]`',
  },
  {
    depType: 'tool.uv.sources',
    description: 'Listed under `[tool.uv.sources]`',
  },
  {
    depType: 'uv.lock',
    description:
      'Transitive dependency resolved in `uv.lock`. Only surfaced for `osvVulnerabilityAlerts`; never updated routinely.',
  },
] as const satisfies readonly DepTypeMetadata[];

export const supportsDynamicDepTypesNote =
  'Hatch environments produce dynamic `depType` values in the form `tool.hatch.envs.<env-name>`.';
