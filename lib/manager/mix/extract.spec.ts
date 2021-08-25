import { loadFixture } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import { extractPackageFile } from '.';

const sample = loadFixture('mix.exs');

describe('manager/mix/extract', () => {
  beforeEach(() => {
    setGlobalConfig({ localDir: '' });
  });

  describe('extractPackageFile()', () => {
    it('returns empty for invalid dependency file', async () => {
      const { deps } = await extractPackageFile('nothing here', 'mix.exs');
      expect(deps).toBeEmpty();
    });
    it('extracts all dependencies', async () => {
      const res = await extractPackageFile(sample, 'mix.exs');
      expect(res).toMatchSnapshot({
        deps: [
          { depName: 'postgrex', currentValue: '~> 0.8.1' },
          { depName: 'ecto', currentValue: '>2.1.0 or <=3.0.0' },
          {
            depName: 'cowboy',
            currentValue: 'ninenines/cowboy',
            datasource: 'github',
            skipReason: 'non-hex depTypes',
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
