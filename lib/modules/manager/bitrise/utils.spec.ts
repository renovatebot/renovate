import { BitriseDatasource } from '../../datasource/bitrise';
import { parseStep } from './utils';

describe('modules/manager/bitrise/utils', () => {
  describe('parseStep()', () => {
    it('returns null on an empty string', () => {
      expect(parseStep('')).toBeNull();
    });

    it('returns dependency for step', () => {
      expect(parseStep('restore-gradle-cache@1.1.2')).toEqual({
        currentValue: '1.1.2',
        datasource: BitriseDatasource.id,
        packageName: 'restore-gradle-cache',
        replaceString: 'restore-gradle-cache@1.1.2',
      });
    });

    it('parses missing version', () => {
      expect(parseStep('share-pipeline-variable')).toEqual({
        datasource: BitriseDatasource.id,
        packageName: 'share-pipeline-variable',
        replaceString: 'share-pipeline-variable',
        skipReason: 'unspecified-version',
      });
    });
  });
});
