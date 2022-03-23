import { loadFixture } from '../../../../test/util';
import { extractPackageFile } from './extract';

const invalidYAML = loadFixture('invalid.yml');
const stepsPipeline = loadFixture('.vela-steps.yml');
const servicesPipeline = loadFixture('.vela-services.yml');
const secretsPipeline = loadFixture('.vela-secrets.yml');
const stagesPipeline = loadFixture('.vela-stages.yaml');

describe('modules/manager/velaci/extract', () => {
  describe('extractPackageFile()', () => {
    it('should handle invalid YAML', () => {
      const res = extractPackageFile(invalidYAML);
      expect(res).toBeNull();
    });

    it('extracts multiple step pipeline image lines', () => {
      const res = extractPackageFile(stepsPipeline);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });

    it('extracts multiple services pipeline image lines', () => {
      const res = extractPackageFile(servicesPipeline);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });

    it('extracts multiple stages pipeline image lines', () => {
      const res = extractPackageFile(stagesPipeline);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });

    it('extracts multiple secrets pipeline image lines', () => {
      const res = extractPackageFile(secretsPipeline);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });
  });
});
