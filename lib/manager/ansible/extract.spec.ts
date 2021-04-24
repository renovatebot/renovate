import { getName, loadFixture } from '../../../test/util';
import extractPackageFile from './extract';

const yamlFile1 = loadFixture('main1.yaml');
const yamlFile2 = loadFixture('main2.yaml');

describe(getName(), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple image lines from docker_container', () => {
      const res = extractPackageFile(yamlFile1);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(9);
    });
    it('extracts multiple image lines from docker_service', () => {
      const res = extractPackageFile(yamlFile2);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(4);
    });
  });
});
