import type { LookupUpdateConfig } from './types.ts';
import { determineNewReplacementName } from './utils.ts';

const lookupConfig: LookupUpdateConfig = {
  datasource: 'npm',
  packageName: 'b',
  currentValue: '1.0.0',
  versioning: 'semver',
  rangeStrategy: 'replace',
};

describe('workers/repository/process/lookup/utils', () => {
  describe('determineNewReplacementName()', () => {
    it('returns the replacement name if defined', () => {
      expect(
        determineNewReplacementName({
          ...lookupConfig,
          replacementName: 'foo',
        }),
      ).toBe('foo');
    });

    it('returns the replacement name template if defined', () => {
      expect(
        determineNewReplacementName({
          ...lookupConfig,
          replacementNameTemplate: 'foo',
        }),
      ).toBe('foo');
    });

    it('returns the package name if defined', () => {
      expect(determineNewReplacementName(lookupConfig)).toBe('b');
    });
  });
});
