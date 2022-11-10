import { Fixtures } from '../../../../test/fixtures';
import { updateDependency } from '.';

const fileContent = Fixtures.get('versions.yaml');

describe('modules/manager/rootcloud-oam/update', () => {
  describe('extractPackageFile()', () => {
    it('returns results', () => {
      const res = updateDependency({
        fileContent,
        upgrade: {
          depName: '@rootcloud/console-ui',
          newValue: '1.21.323',
        },
      });
      expect(res).toMatchSnapshot();
    });
  });
});
