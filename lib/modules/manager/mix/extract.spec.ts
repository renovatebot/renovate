import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import { extractPackageFile } from '.';

describe('modules/manager/mix/extract', () => {
  beforeEach(() => {
    GlobalConfig.set({ localDir: '' });
  });

  describe('extractPackageFile()', () => {
    it('returns empty for invalid dependency file', async () => {
      const { deps } = await extractPackageFile('nothing here', 'mix.exs');
      expect(deps).toBeEmpty();
    });
    it('extracts all dependencies', async () => {
      const res = await extractPackageFile(Fixtures.get('mix.exs'), 'mix.exs');
      expect(res).toMatchSnapshot({
        deps: [
          { depName: 'postgrex', currentValue: '~> 0.8.1' },
          { depName: 'ecto', currentValue: '>2.1.0 or <=3.0.0' },
          {
            depName: 'cowboy',
            currentValue: 'ninenines/cowboy',
            datasource: 'github',
            skipReason: 'non-hex-dep-types',
          },
          {
            depName: 'secret',
            currentValue: '~> 1.0',
            datasource: 'hex',
            lookupName: 'secret:acme',
          },
          { depName: 'ex_doc', currentValue: '>2.1.0 and <=3.0.0' },
          { depName: 'jason', currentValue: '>= 1.0.0' },
          { depName: 'jason', currentValue: '~> 1.0' },
        ],
      });
    });
  });
});
