import { DartVersionDatasource } from '../../../datasource/dart-version/index.ts';
import type { KnownActionConfig } from '../types.ts';
import { partialValSchema } from './utils.ts';

export const dartVersionActions: Record<string, KnownActionConfig> = {
  // https://github.com/dart-lang/setup-dart
  'dart-lang/setup-dart': {
    datasource: DartVersionDatasource.id,
    depName: 'dart',
    packageName: 'dart-lang/sdk',
    // an SDK release version such as `3.1` means the latest patch release of
    // that version, rather than a pinned version
    withSchema: partialValSchema('sdk'),
  },
};
