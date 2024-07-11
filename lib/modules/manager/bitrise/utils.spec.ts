import { parseStep } from './utils';

describe('modules/manager/bitrise/utils', () => {
  describe('parseStep()', () => {
    it('returns null on an empty string', () => {
      expect(parseStep('')).toBeNull();
    });

    it('returns dependency for step', () => {
      expect(parseStep('restore-gradle-cache@1.1.2')).toEqual({
        "currentValue": "1.1.2",
        "datasource": "github-releases",
        "depName": "restore-gradle-cache",
        "packageName": "bitrise-steplib/steps-restore-gradle-cache"
      });
    })

    it('returns legacy packageName ', () => {
      expect(parseStep('share-pipeline-variable@2.1.2')).toEqual({
        "currentValue": "2.1.2",
        "datasource": "github-releases",
        "depName": "restore-gradle-cache",
        "packageName": "bitrise-steplib/bitrise-steps-restore-gradle-cache"
      });
    })
  });
});
