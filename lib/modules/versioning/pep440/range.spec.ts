import { logger } from '../../../logger';
import { checkRangeAndRemoveUnnecessaryRangeLimit, getNewValue } from './range';

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
});
