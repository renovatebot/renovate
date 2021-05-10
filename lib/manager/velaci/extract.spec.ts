import { getName, loadFixture } from '../../../test/util';

import { extractPackageFile } from './extract';

const stepsPipeline = loadFixture('.vela-steps.yaml');

const stagesPipeline = loadFixture('.vela-stages.yml');

describe(getName(), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts multiple step pipeline image lines', () => {
      const res = extractPackageFile(stepsPipeline);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(5);
    });

    it('extracts multiple stages pipeline image lines', () => {
      const res = extractPackageFile(stagesPipeline);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(5);
    });
  });
});
