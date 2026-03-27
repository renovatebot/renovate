import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'action',
    description:
      'A repository-based action reference in a `uses:` field (e.g. `actions/checkout@v4`)',
  },
  {
    depType: 'docker',
    description:
      'A Docker image reference in a `uses:` field (e.g. `uses: docker://alpine:3`)',
  },
  {
    depType: 'container',
    description: "A Docker image specified in a job's `container:` field",
  },
  {
    depType: 'service',
    description: "A Docker image specified in a job's `services:` field",
  },
  {
    depType: 'github-runner',
    description:
      'A GitHub-hosted runner version in a `runs-on:` field (e.g. `ubuntu-24.04`)',
  },
  {
    depType: 'uses-with',
    description:
      'A language/runtime version passed as an input to a versioned action (e.g. `node-version` for `actions/setup-node`)',
  },
] as const satisfies readonly DepTypeMetadata[];

export type GithubActionsDepType = (typeof knownDepTypes)[number]['depType'];
