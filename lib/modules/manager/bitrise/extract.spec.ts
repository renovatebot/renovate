import { codeBlock } from 'common-tags';
import { extractPackageFile } from '../fvm';
import { GithubReleasesDatasource } from '../../datasource/github-releases';

describe('modules/manager/bitrise/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null on an empty file', () => {
      expect(extractPackageFile('')).toBeNull();
    });

    it('returns valid file', () => {
      expect(
        extractPackageFile(codeBlock`
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
      `),
      ).toEqual({
        deps: [
          {
            datasource: GithubReleasesDatasource.id,
            depName: "script",
            packageName: "bitrise-steplib/steps-script",
            currentValue: '1.1.5',
          },
          {
            datasource: GithubReleasesDatasource.id,
            depName: "restore-cache",
            packageName: "bitrise-steplib/steps-restore-cache",
            currentValue: '1.1.2',
          }
        ]
      });
    });
  });
});
