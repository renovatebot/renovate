import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

const invalidYamlFile = Fixtures.get('invalid.yaml');

const pluginsTextFile = Fixtures.get('plugins.txt');
const pluginsYamlFile = Fixtures.get('plugins.yaml');

const pluginsEmptyTextFile = Fixtures.get('empty.txt');
const pluginsEmptyYamlFile = Fixtures.get('empty.yaml');

describe('modules/manager/jenkins/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns empty list for an empty text file', () => {
      const res = extractPackageFile(pluginsEmptyTextFile, 'path/file.txt');
      expect(res).toBeNull();
    });

    it('returns empty list for an empty yaml file', () => {
      const res = extractPackageFile(pluginsEmptyYamlFile, 'path/file.yaml');
      expect(res).toBeNull();
    });

    it('returns empty list for an invalid yaml file', () => {
      const res = extractPackageFile(invalidYamlFile, 'path/file.yaml');
      expect(res).toBeNull();
    });

    it('extracts multiple image lines in text format', () => {
      const res = extractPackageFile(pluginsTextFile, 'path/file.txt');
      expect(res?.deps).toEqual([
        {
          currentValue: '1.2.3',
          datasource: 'jenkins-plugins',
          depName: 'email-ext',
          versioning: 'maven',
        },
        {
          currentValue: '4.4.10-2.0',
          datasource: 'jenkins-plugins',
          depName: 'apache-httpcomponents-client-4-api',
          versioning: 'maven',
        },
        {
          currentValue: '1.2',
          datasource: 'jenkins-plugins',
          depName: 'authentication-tokens',
          versioning: 'maven',
        },
        {
          currentValue: '1.21.0',
          datasource: 'jenkins-plugins',
          depName: 'blueocean',
          versioning: 'maven',
        },
        {
          currentValue: '4.2.0',
          datasource: 'jenkins-plugins',
          depName: 'git',
          skipReason: 'ignored',
          versioning: 'maven',
        },
        {
          currentValue: '3.3.1',
          datasource: 'jenkins-plugins',
          depName: 'git-client',
          skipReason: 'ignored',
          versioning: 'maven',
        },
      ]);
      expect(res?.deps).toHaveLength(6);
    });

    it('extracts multiple image lines in yaml format', () => {
      const res = extractPackageFile(pluginsYamlFile, 'path/file.yml');
      expect(res?.deps).toEqual([
        {
          currentValue: 'latest',
          datasource: 'jenkins-plugins',
          depName: 'git',
          skipReason: 'unsupported-version',
          versioning: 'maven',
        },
        {
          currentValue: '2.10',
          datasource: 'jenkins-plugins',
          depName: 'job-import-plugin',
          versioning: 'maven',
        },
        {
          currentValue: '2.1',
          datasource: 'jenkins-plugins',
          depName: 'invalid-version-plugin',
          skipReason: 'invalid-version',
          versioning: 'maven',
        },
        {
          currentValue: '2.10',
          datasource: 'jenkins-plugins',
          depName: 'ignore-plugin',
          skipReason: 'ignored',
          versioning: 'maven',
        },
        {
          datasource: 'jenkins-plugins',
          depName: 'docker',
          skipReason: 'unspecified-version',
          versioning: 'maven',
        },
        {
          currentValue: 'experimental',
          datasource: 'jenkins-plugins',
          depName: 'cloudbees-bitbucket-branch-source',
          skipReason: 'unsupported-version',
          versioning: 'maven',
        },
        {
          datasource: 'jenkins-plugins',
          depName: 'script-security',
          skipReason: 'internal-package',
          versioning: 'maven',
        },
        {
          currentValue: '2.19-rc289.d09828a05a74',
          datasource: 'jenkins-plugins',
          depName: 'workflow-step-api',
          skipReason: 'unsupported-version',
          versioning: 'maven',
        },
      ]);
      expect(res?.deps).toHaveLength(8);
    });
  });
});
