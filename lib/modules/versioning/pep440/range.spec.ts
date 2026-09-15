import { logger } from '../../../logger/index.ts';
import {
  checkRangeAndRemoveUnnecessaryRangeLimit,
  getNewValue,
} from './range.ts';

describe('modules/versioning/pep440/range', () => {
  it.each`
    rangeInput           | newVersion | expected
    ${'==4.1.*,>=3.2.2'} | ${'4.1.1'} | ${'==4.1.*'}
    ${'==4.0.*,>=3.2.2'} | ${'4.0.0'} | ${'==4.0.*'}
    ${'==7.2.*'}         | ${'7.2.0'} | ${'==7.2.*'}
  `(
    'checkRange("$rangeInput, "$newVersion"") === "$expected"',
    ({ rangeInput, newVersion, expected }) => {
      const res = checkRangeAndRemoveUnnecessaryRangeLimit(
        rangeInput,
        newVersion,
      );
      expect(res).toEqual(expected);
    },
  );

  it('returns null without warning if new version is excluded from range', () => {
    const res = getNewValue({
      currentValue: '>=1.25.0,<2,!=1.32.0',
      rangeStrategy: 'auto',
      newVersion: '1.32.0',
      currentVersion: '1.25.0',
    });
    expect(res).toBeNull();

    expect(logger.debug).toHaveBeenCalledWith(
      'Cannot calculate new value as the newVersion:`1.32.0` is excluded from range: `>=1.25.0,<2,!=1.32.0`',
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('handles v-prefixed version as currentValue', () => {
    const res = getNewValue({
      currentValue: 'v0.7.15',
      rangeStrategy: 'auto',
      newVersion: '0.8.0',
      currentVersion: '0.7.15',
    });
    expect(res).toBe('v0.8.0');
  });

  it('handles bare version that differs from currentVersion without v-prefix', () => {
    const res = getNewValue({
      currentValue: '1.0.0.0',
      rangeStrategy: 'auto',
      newVersion: '1.2.3',
      currentVersion: '1.0.0',
    });
    expect(res).toBe('1.2.3');
  });

  it('drops a local version segment from a compatible release specifier', () => {
    // A local segment is not valid in `~=`, so keeping it would build a range
    // that matches nothing and the update would be abandoned.
    expect(
      getNewValue({
        currentValue: '~=38.0.0',
        rangeStrategy: 'replace',
        currentVersion: '38.0.0',
        newVersion: '38.3.3.post1+git.5af13757',
      }),
    ).toBe('~=38.3.3.post1');

    expect(
      getNewValue({
        currentValue: '~=38.0.0',
        rangeStrategy: 'bump',
        currentVersion: '38.0.0',
        newVersion: '38.3.3+local.1',
      }),
    ).toBe('~=38.3.3');
  });
});
