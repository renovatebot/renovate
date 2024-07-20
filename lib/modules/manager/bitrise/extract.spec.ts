import { codeBlock } from 'common-tags';
import { BitriseDatasource } from '../../datasource/bitrise';
import { extractPackageFile } from '.';

describe('modules/manager/bitrise/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null on an empty file', () => {
      expect(extractPackageFile('', 'bitrise.yml')).toBeNull();
    });

    it('returns a valid file', () => {
      expect(
        extractPackageFile(
          codeBlock`
      workflows:
        test:
          steps:
          - script@1.1.5:
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
        ],
      });
    });

    it('returns a valid file with custom default_step_lib_source', () => {
      expect(
        extractPackageFile(
          codeBlock`
      format_version: 11
      default_step_lib_source: https://github.com/custom/steplib.git
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
            registryUrls: ['https://github.com/custom/steplib.git'],
          },
          {
            datasource: BitriseDatasource.id,
            packageName: 'restore-cache',
            currentValue: '1.1.2',
            replaceString: 'restore-cache@1.1.2',
            registryUrls: ['https://github.com/custom/steplib.git'],
          },
        ],
      });
    });

    it('extracts git and path prefixes', () => {
      expect(
        extractPackageFile(
          codeBlock`
      workflows:
        test:
          steps:
          - git::https://github.com/bitrise-io/steps-script.git@1.1.3:
          - path::./relative/path:
          - https://github.com/foo/bar.git::script@1:
      `,
          'bitrise.yml',
        ),
      ).toEqual({
        deps: [
          {
            currentValue: '1.1.3',
            datasource: 'git-tags',
            packageName: 'https://github.com/bitrise-io/steps-script.git',
            replaceString:
              'git::https://github.com/bitrise-io/steps-script.git@1.1.3',
          },
          {
            datasource: 'bitrise',
            packageName: 'path::./relative/path',
            replaceString: 'path::./relative/path',
            skipReason: 'unspecified-version',
          },
          {
            currentValue: '1',
            datasource: 'bitrise',
            packageName: 'script',
            registryUrls: ['https://github.com/foo/bar.git'],
            replaceString: 'https://github.com/foo/bar.git::script@1',
          },
        ],
      });
    });

    it('extracts Bitrise library reference', () => {
      expect(
        extractPackageFile(
          codeBlock`
      workflows:
        test:
          steps:
          - https://github.com/foo/bar.git::script@1:
      `,
          'bitrise.yml',
        ),
      ).toEqual({
        deps: [
          {
            currentValue: '1',
            datasource: 'bitrise',
            packageName: 'script',
            registryUrls: ['https://github.com/foo/bar.git'],
            replaceString: 'https://github.com/foo/bar.git::script@1',
          },
        ],
      });
    });
  });
});
