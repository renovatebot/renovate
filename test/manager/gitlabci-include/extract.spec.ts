import fs from 'fs';
import { extractPackageFile } from '../../../lib/manager/gitlabci-include/extract';

const yamlFile = fs.readFileSync(
  'test/manager/gitlabci-include/_fixtures/gitlab-ci.yaml',
  'utf8'
);

describe('lib/manager/gitlabci-include/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(
        extractPackageFile({
          fileContent: 'nothing here',
          fileName: '.gitlab-ci.yml',
          config: {},
        })
      ).toBeNull();
    });
    it('extracts multiple include blocks', () => {
      const res = extractPackageFile({
        fileContent: yamlFile,
        fileName: '.gitlab-ci.yml',
        config: {},
      });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });
    it('normalizes configured endpoints', () => {
      const endpoints = [
        'http://gitlab.test/api/v4',
        'http://gitlab.test/api/v4/',
      ];
      endpoints.forEach(endpoint => {
        const res = extractPackageFile({
          fileContent: yamlFile,
          fileName: '.gitlab-ci.yml',
          config: {
            endpoint,
          },
        });
        expect(res.deps[0].registryUrls[0]).toEqual('http://gitlab.test');
      });
    });
  });
});
