import fs from 'fs';
import { getName } from '../../../test/util';
import { extractPackageFile } from './extract';

const yamlFile = fs.readFileSync(
  'lib/manager/gitlabci-include/__fixtures__/gitlab-ci.1.yaml',
  'utf8'
);

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(
        extractPackageFile('nothing here', '.gitlab-ci.yml', {})
      ).toBeNull();
    });
    it('extracts multiple include blocks', () => {
      const res = extractPackageFile(yamlFile, '.gitlab-ci.yml', {});
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });
    it('normalizes configured endpoints', () => {
      const endpoints = [
        'http://gitlab.test/api/v4',
        'http://gitlab.test/api/v4/',
      ];

      for (const endpoint of endpoints) {
        const res = extractPackageFile(yamlFile, '.gitlab-ci.yml', {
          endpoint,
        });
        expect(res.deps[0].registryUrls[0]).toEqual('http://gitlab.test');
      }
    });
  });
});
