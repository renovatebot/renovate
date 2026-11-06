import { partial } from '~test/util.ts';
import gradle from '../../../../modules/versioning/gradle/index.ts';
import * as allVersioning from '../../../../modules/versioning/index.ts';
import loose from '../../../../modules/versioning/loose/index.ts';
import maven from '../../../../modules/versioning/maven/index.ts';
import type { VersioningApi } from '../../../../modules/versioning/types.ts';
import { generateUpdate } from './generate.ts';
import type { LookupUpdateConfig } from './types.ts';
import { classifyRelease } from './update-type.ts';

const npmVersioning = allVersioning.get('npm');
const pvpVersioning = allVersioning.get('pvp');

describe('workers/repository/process/lookup/update-type', () => {
  describe('classifyRelease()', () => {
    it.each`
      currentVersion | newVersion | expected
      ${'1.0.0'}     | ${'2.0.0'} | ${'major'}
      ${'1.0.0'}     | ${'1.1.0'} | ${'minor'}
      ${'1.0.0'}     | ${'1.0.1'} | ${'patch'}
      ${'1.0.0'}     | ${'1.0.0'} | ${'patch'}
    `(
      'compares the numbers for $currentVersion -> $newVersion without isSame()',
      ({ currentVersion, newVersion, expected }) => {
        expect(npmVersioning.isSame).toBeUndefined();

        expect(classifyRelease(npmVersioning, currentVersion, newVersion)).toBe(
          expected,
        );
      },
    );

    it.each`
      currentVersion | newVersion    | expected
      ${'1.1.0.0'}   | ${'1.10.0.0'} | ${'major'}
      ${'1.1.0.0'}   | ${'1.2.0.0'}  | ${'major'}
      ${'1.1.0.0'}   | ${'1.1.1.0'}  | ${'minor'}
      ${'1.1.0.0'}   | ${'1.1.0.1'}  | ${'patch'}
    `(
      'asks isSame() for $currentVersion -> $newVersion',
      ({ currentVersion, newVersion, expected }) => {
        expect(classifyRelease(pvpVersioning, currentVersion, newVersion)).toBe(
          expected,
        );
      },
    );

    it('does not fall back to the numbers when isSame() is implemented', () => {
      // `pvp` squashes its first two components into a float, so the numbers say these versions share a major
      expect(pvpVersioning.getMajor('1.1.0.0')).toBe(
        pvpVersioning.getMajor('1.10.0.0'),
      );

      const versioningApi = partial<VersioningApi>({
        isSame: (type) => type !== 'minor',
      });

      expect(classifyRelease(versioningApi, '1.2.3', '1.3.4')).toBe('minor');
    });

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
    `(
      'classifies $currentVersion -> $newVersion as $expected beyond safe-integer precision',
      ({ versioningApi, currentVersion, newVersion, expected }) => {
        expect(classifyRelease(versioningApi, currentVersion, newVersion)).toBe(
          expected,
        );
      },
    );
  });

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
