import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'prod',
    description: 'Listed in the top-level `{deps, [...]}` tuple',
  },
  {
    depType: 'test',
    description: 'Listed under the `test` profile',
  },
] as const satisfies readonly DepTypeMetadata[];

export const supportsDynamicDepTypesNote =
  'Any other rebar3 profile name is also used as a `depType`, so `{profiles, [{docs, [{deps, [...]}]}]}` yields `depType=docs`.';
