import { Fixtures } from '../../../test/fixtures';
import { extractPackageFile } from './extract';

describe('manager/github-actions/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple docker image lines from yaml configuration file', () => {
      const res = extractPackageFile(Fixtures.get('workflow_1.yml'));
      expect(res.deps).toMatchSnapshot();
      expect(res.deps.filter((d) => d.datasource === 'docker')).toHaveLength(2);
    });
    it('extracts multiple action tag lines from yaml configuration file', () => {
      const res = extractPackageFile(Fixtures.get('workflow_2.yml'));
      expect(res.deps).toMatchSnapshot();
      expect(
        res.deps.filter((d) => d.datasource === 'github-tags')
      ).toHaveLength(5);
    });
  });
});
