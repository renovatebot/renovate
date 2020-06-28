import fs from 'fs';
import { extractPackageFile } from './extract';

const yamlFile = fs.readFileSync(
  'lib/manager/gitlabci-include/__fixtures__/gitlab-ci.1.yaml',
  'utf8'
);
const yamlLocal = fs.readFileSync(
  'lib/manager/gitlabci-include/__fixtures__/gitlab-ci.2.yaml',
  'utf8'
);

const yamlLocalBlock = fs.readFileSync(
  'lib/manager/gitlabci-include/__fixtures__/gitlab-ci.3.yaml',
  'utf8'
);

describe('lib/manager/gitlabci-include/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      expect(
        await extractPackageFile('nothing here', '.gitlab-ci.yml', {})
      ).toBeNull();
    });
    it('extracts multiple include blocks', async () => {
      const res = await extractPackageFile(yamlFile, '.gitlab-ci.yml', {});
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });
    it('extracts local include block', async () => {
      const res = await extractPackageFile(yamlLocal, '.gitlab-ci.yml', {});
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
    it('extracts multiple local include blocks', async () => {
      const res = await extractPackageFile(
        yamlLocalBlock,
        '.gitlab-ci.yml',
        {}
      );
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });
    it('normalizes configured endpoints', async () => {
      const endpoints = [
        'http://gitlab.test/api/v4',
        'http://gitlab.test/api/v4/',
      ];

      for (const endpoint of endpoints) {
        const res = await extractPackageFile(yamlFile, '.gitlab-ci.yml', {
          endpoint,
        });
        expect(res.deps[0].registryUrls[0]).toEqual('http://gitlab.test');
      }
    });
  });
});
