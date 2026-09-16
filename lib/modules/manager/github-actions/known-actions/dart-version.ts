import { DartVersionDatasource } from '../../../datasource/dart-version/index.ts';
import type { KnownActionConfig } from '../types.ts';
import { valSchema } from './utils.ts';

export const dartVersionActions: Record<string, KnownActionConfig> = {
  // https://github.com/dart-lang/setup-dart
  'dart-lang/setup-dart': {
    datasource: DartVersionDatasource.id,
    depName: 'dart',
    packageName: 'dart-lang/sdk',
    withSchema: valSchema('sdk'),
  },
};
