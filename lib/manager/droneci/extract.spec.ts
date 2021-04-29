import { getName, loadFixture } from '../../../test/util';

import { extractPackageFile } from './extract';

const droneYAML = loadFixture('.drone.yml');

describe(getName(), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts multiple image lines', () => {
      const res = extractPackageFile(droneYAML);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(4);
    });
  });
});
