import fs from 'fs';
import { extractPackageFile } from '../../../lib/manager/gitlabci-include/extract';
import { ExtractConfig } from '../../../lib/manager/common';

const yamlFile = fs.readFileSync(
  'test/manager/gitlabci-include/_fixtures/gitlab-ci.yaml',
  'utf8'
);

describe('lib/manager/gitlabci-include/extract', () => {
  describe('extractPackageFile()', () => {
    let config: ExtractConfig;
    beforeEach(() => {
      config = {
        endpoint: 'http://gitlab.test/api/v4/',
      };
    });
    it('returns null for empty', () => {
      expect(
        extractPackageFile('nothing here', '.gitlab-ci.yml', config)
      ).toBeNull();
    });
    it('extracts multiple include blocks', () => {
      const res = extractPackageFile(yamlFile, '.gitlab-ci.yml', config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });
  });
});
