import { Fixtures } from '../../../../test/fixtures';
import { bumpPackageVersion } from '.';

const fileContent = Fixtures.get('versions.yaml');

describe('modules/manager/rootcloud-oam/bump', () => {
  describe('extractPackageFile()', () => {
    it('returns results', () => {
      const res = bumpPackageVersion(fileContent, '1.0.0', 'patch');
      expect(res).toMatchSnapshot();
    });
  });
});
