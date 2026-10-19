import type { LookupUpdate } from '../../../../modules/manager/types.ts';
import {
  matchVersionCompatibility,
  restoreVersionCompatibility,
} from './version-compatibility.ts';

const versionCompatibility = '^(?<version>[^-]+)(?<compatibility>-.+)?$';

describe('workers/repository/process/lookup/version-compatibility', () => {
  describe('matchVersionCompatibility()', () => {
    it('returns null if versionCompatibility is not configured', () => {
      expect(
        matchVersionCompatibility({ currentValue: '1.0.0-alpine' }),
      ).toBeNull();
    });

    it('returns null if currentValue is not a string', () => {
      expect(matchVersionCompatibility({ versionCompatibility })).toBeNull();
    });

    it('returns null if the regex does not match', () => {
      expect(
        matchVersionCompatibility({
          currentValue: '1.0.0-alpine',
          versionCompatibility: '^(?<version>\\d+)$',
        }),
      ).toBeNull();
    });

    it('splits the version and compatibility parts', () => {
      expect(
        matchVersionCompatibility({
          currentValue: '1.0.0-alpine',
          versionCompatibility,
        }),
      ).toEqual({ compareValue: '1.0.0', currentCompatibility: '-alpine' });
    });

    it('returns an undefined compatibility if the group did not match', () => {
      expect(
        matchVersionCompatibility({
          currentValue: '1.0.0',
          versionCompatibility,
        }),
      ).toEqual({ compareValue: '1.0.0', currentCompatibility: undefined });
    });
  });

  describe('restoreVersionCompatibility()', () => {
    it('does nothing if versionCompatibility is not configured', () => {
      const updates: LookupUpdate[] = [{ newValue: '1.1.0' }];

      restoreVersionCompatibility(
        { currentValue: '1.0.0-alpine' },
        '1.0.0',
        updates,
      );

      expect(updates).toEqual([{ newValue: '1.1.0' }]);
    });

    it('does nothing if compareValue is undefined', () => {
      const updates: LookupUpdate[] = [{ newValue: '1.1.0' }];

      restoreVersionCompatibility(
        { currentValue: '1.0.0-alpine', versionCompatibility },
        undefined,
        updates,
      );

      expect(updates).toEqual([{ newValue: '1.1.0' }]);
    });

    it('puts the compatibility part back onto newValue', () => {
      const updates: LookupUpdate[] = [
        { newValue: '1.1.0' },
        { newValue: '2.0.0' },
      ];

      restoreVersionCompatibility(
        { currentValue: '1.0.0-alpine', versionCompatibility },
        '1.0.0',
        updates,
      );

      expect(updates).toEqual([
        { newValue: '1.1.0-alpine' },
        { newValue: '2.0.0-alpine' },
      ]);
    });
  });
});
