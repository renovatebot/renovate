import { partial } from '~test/util.ts';
import * as allVersioning from '../../../../modules/versioning/index.ts';
import type { VersioningApi } from '../../../../modules/versioning/types.ts';
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
  });
});
