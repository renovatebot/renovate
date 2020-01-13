import { readFileSync } from 'fs';
import { extractPackageFile } from '../../../lib/manager/gitlabci/extract';

const yamlFile = readFileSync(
  'test/manager/gitlabci/_fixtures/gitlab-ci.yaml',
  'utf8'
);

const yamlFile1 = readFileSync(
  'test/manager/gitlabci/_fixtures/gitlab-ci.1.yaml',
  'utf8'
);

describe('lib/manager/gitlabci/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile({ content: 'nothing here' })).toBeNull();
    });
    it('extracts multiple image lines', () => {
      const res = extractPackageFile({ content: yamlFile });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
    });

    it('extracts multiple image lines with comments', () => {
      const res = extractPackageFile({ content: yamlFile1 });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });
  });
});
