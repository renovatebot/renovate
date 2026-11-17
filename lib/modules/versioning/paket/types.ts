import type { NugetVersion } from '../nuget/types.ts';

export type PaketOperator = '' | '=' | '==' | '>' | '>=' | '<' | '<=' | '~>';

export interface PaketConstraint {
  operator: PaketOperator;
  version: NugetVersion;
}

export interface PaketRange {
  strategy: '!' | '@' | null;
  constraints: PaketConstraint[];
  prereleaseTags: string[];
}

export type PaketInterval =
  | {
      kind:
        | 'specific'
        | 'override'
        | 'minimum'
        | 'greater-than'
        | 'maximum'
        | 'less-than';
      version: NugetVersion;
    }
  | {
      kind: 'range';
      from: NugetVersion;
      fromInclusive: boolean;
      to: NugetVersion;
      toInclusive: boolean;
    };
