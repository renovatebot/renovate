import { readFileSync } from 'fs';
import { extractPackageFile } from './extract';

const yamlFile = readFileSync(
  'lib/manager/gitlabci/__fixtures__/gitlab-ci.yaml',
  'utf8'
);

const yamlFile1 = readFileSync(
  'lib/manager/gitlabci/__fixtures__/gitlab-ci.1.yaml',
  'utf8'
);

describe('lib/manager/gitlabci/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple image lines', () => {
      const res = extractPackageFile(yamlFile);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(7);
      expect(res.deps.some((dep) => dep.currentValue.includes("'"))).toBe(
        false
      );
    });

    it('extracts multiple image lines with comments', () => {
      const res = extractPackageFile(yamlFile1);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });
  });
});
