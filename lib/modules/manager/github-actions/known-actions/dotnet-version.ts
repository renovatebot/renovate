import { DotnetVersionDatasource } from '../../../datasource/dotnet-version/index.ts';
import * as npmVersioning from '../../../versioning/npm/index.ts';
import type { KnownActionConfig } from '../types.ts';
import { valSchema } from './utils.ts';

export const dotnetVersionActions: Record<string, KnownActionConfig> = {
  // https://github.com/actions/setup-dotnet
  'actions/setup-dotnet': {
    datasource: DotnetVersionDatasource.id,
    packageName: 'dotnet-sdk',
    // `dotnet-version` may be a channel (`8.0`), an x-range (`8.0.x`, `8.x`)
    // or a major (`8`) rather than a pinned version, so it needs a versioning
    // which understands ranges
    versioning: npmVersioning.id,
    withSchema: valSchema('dotnet-version', (val) => val.includes('\n')),
  },
};
