import { codeBlock } from 'common-tags';
import { BitriseDatasource } from '../../datasource/bitrise';
import { extractPackageFile } from '.';

describe('modules/manager/bitrise/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null on an empty file', () => {
      expect(extractPackageFile('', 'bitrise.yml')).toBeNull();
    });

    it('returns valid file', () => {
      expect(
        extractPackageFile(
          codeBlock`
      format_version: 11
      default_step_lib_source: https://github.com/bitrise-io/bitrise-steplib.git
      project_type: android
      app:
        envs:
        - MY_NAME: My Name
      workflows:
        test:
          steps:
          - script@1.1.5:
              inputs:
              - content: echo "Hello!"
          - restore-cache@1.1.2:
              foo: bar
      `,
          'bitrise.yml',
        ),
      ).toEqual({
        deps: [
          {
            datasource: BitriseDatasource.id,
            packageName: 'script',
            currentValue: '1.1.5',
            replaceString: 'script@1.1.5',
          },
          {
            datasource: BitriseDatasource.id,
            packageName: 'restore-cache',
            currentValue: '1.1.2',
            replaceString: 'restore-cache@1.1.2',
          },
        ],
      });
    });
  });
});
