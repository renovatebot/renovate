import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const inputContent = Fixtures.get('versions.yaml');

describe('modules/manager/rootcloud-oam/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns empty if fails to parse', () => {
      const res = extractPackageFile('blahhhhh:foo:@what\n');
      expect(res).toBeNull();
    });

    it('returns results', () => {
      const res = extractPackageFile(inputContent);
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(2);
    });
  });
});
