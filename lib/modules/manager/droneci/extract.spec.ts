import { Fixtures } from '../../../../test/fixtures';

import { extractPackageFile } from './extract';

describe('modules/manager/droneci/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts multiple image lines', () => {
      const res = extractPackageFile(Fixtures.get('.drone.yml'));
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
    });
  });
});
