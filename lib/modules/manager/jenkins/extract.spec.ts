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
      expect(res?.deps).toMatchObject([
        { currentValue: '1.2.3', depName: 'email-ext' },
        {
          currentValue: '4.4.10-2.0',
          depName: 'apache-httpcomponents-client-4-api',
        },
        { currentValue: '1.2', depName: 'authentication-tokens' },
        { currentValue: '1.21.0', depName: 'blueocean' },
        { currentValue: '4.2.0', depName: 'git', skipReason: 'ignored' },
        { currentValue: '3.3.1', depName: 'git-client', skipReason: 'ignored' },
      ]);
      expect(res?.deps).toHaveLength(6);
    });

    it('extracts multiple image lines in yaml format', () => {
      const res = extractPackageFile(pluginsYamlFile, 'path/file.yml');
      expect(res?.deps).toMatchObject([
        {
          currentValue: 'latest',
          depName: 'git',
          skipReason: 'unsupported-version',
        },
        { currentValue: '2.10', depName: 'job-import-plugin' },
        {
          currentValue: '2.1',
          depName: 'invalid-version-plugin',
          skipReason: 'invalid-version',
        },
        {
          currentValue: '2.10',
          depName: 'ignore-plugin',
          skipReason: 'ignored',
        },
        { depName: 'docker', skipReason: 'unspecified-version' },
        {
          currentValue: 'experimental',
          depName: 'cloudbees-bitbucket-branch-source',
          skipReason: 'unsupported-version',
        },
        { depName: 'script-security', skipReason: 'internal-package' },
        {
          currentValue: '2.19-rc289.d09828a05a74',
          depName: 'workflow-step-api',
          skipReason: 'unsupported-version',
        },
      ]);
      expect(res?.deps).toHaveLength(8);
    });
  });
});
