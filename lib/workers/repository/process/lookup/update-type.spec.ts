import { partial } from '~test/util.ts';
import gradle from '../../../../modules/versioning/gradle/index.ts';
import loose from '../../../../modules/versioning/loose/index.ts';
import maven from '../../../../modules/versioning/maven/index.ts';
import npm from '../../../../modules/versioning/npm/index.ts';
import { generateUpdate } from './generate.ts';
import type { LookupUpdateConfig } from './types.ts';
import { getUpdateType } from './update-type.ts';

describe('workers/repository/process/lookup/update-type', () => {
  it.each`
    versioningApi | currentVersion                  | newVersion                      | expected
    ${gradle}     | ${'2026051723231779060202'}     | ${'2026051723231779060208'}     | ${'major'}
    ${maven}      | ${'2026051723231779060202'}     | ${'2026051723231779060208'}     | ${'major'}
    ${loose}      | ${'2026051723231779060202'}     | ${'2026051723231779060208'}     | ${'major'}
    ${gradle}     | ${'1.2026051723231779060202'}   | ${'1.2026051723231779060208'}   | ${'minor'}
    ${maven}      | ${'1.2026051723231779060202'}   | ${'1.2026051723231779060208'}   | ${'minor'}
    ${loose}      | ${'1.2026051723231779060202'}   | ${'1.2026051723231779060208'}   | ${'minor'}
    ${gradle}     | ${'1.1.2026051723231779060202'} | ${'1.1.2026051723231779060208'} | ${'patch'}
    ${maven}      | ${'1.1.2026051723231779060202'} | ${'1.1.2026051723231779060208'} | ${'patch'}
    ${loose}      | ${'1.1.2026051723231779060202'} | ${'1.1.2026051723231779060208'} | ${'patch'}
    ${loose}      | ${'1'}                          | ${'1.0.1'}                      | ${'patch'}
    ${loose}      | ${'1.0.1'}                      | ${'1'}                          | ${'patch'}
    ${npm}        | ${'1.0.0'}                      | ${'2.0.0'}                      | ${'major'}
    ${npm}        | ${'1.0.0'}                      | ${'1.1.0'}                      | ${'minor'}
    ${npm}        | ${'1.0.0'}                      | ${'1.0.1'}                      | ${'patch'}
  `(
    'classifies $currentVersion -> $newVersion as $expected',
    ({ versioningApi, currentVersion, newVersion, expected }) => {
      expect(getUpdateType({}, versioningApi, currentVersion, newVersion)).toBe(
        expected,
      );
    },
  );

  it.each`
    versioningApi
    ${gradle}
    ${maven}
    ${loose}
  `(
    'marks the unsafe-integer update as breaking',
    async ({ versioningApi }) => {
      const currentVersion = '2026051723231779060202';
      const newVersion = '2026051723231779060208';

      const update = await generateUpdate(
        partial<LookupUpdateConfig>({}),
        currentVersion,
        versioningApi,
        'replace',
        currentVersion,
        'latest',
        { version: newVersion },
        new Set([currentVersion, newVersion]),
      );

      expect(update).toMatchObject({
        isBreaking: true,
        updateType: 'major',
      });
    },
  );
});
