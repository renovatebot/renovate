import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const workflow1 = loadFixture(__filename, 'workflow.yml.1');
const workflow2 = loadFixture(__filename, 'workflow.yml.2');

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple docker image lines from yaml configuration file', () => {
      const res = extractPackageFile(workflow1);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps.filter((d) => d.datasource === 'docker')).toHaveLength(2);
    });
    it('extracts multiple action tag lines from yaml configuration file', () => {
      const res = extractPackageFile(workflow2);
      expect(res.deps).toMatchSnapshot();
      expect(
        res.deps.filter((d) => d.datasource === 'github-tags')
      ).toHaveLength(3);
    });
  });
});
