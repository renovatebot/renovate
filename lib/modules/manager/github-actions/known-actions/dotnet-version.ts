import { DotnetVersionDatasource } from '../../../datasource/dotnet-version/index.ts';
import type { KnownActionConfig } from '../types.ts';
import { valSchema } from './utils.ts';

export const dotnetVersionActions: Record<string, KnownActionConfig> = {
  // https://github.com/actions/setup-dotnet
  'actions/setup-dotnet': {
    datasource: DotnetVersionDatasource.id,
    packageName: 'dotnet-sdk',
    withSchema: valSchema('dotnet-version', (val) => val.includes('\n')),
  },
};
