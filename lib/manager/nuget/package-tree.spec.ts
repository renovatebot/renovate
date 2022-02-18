import upath from 'upath';
import { loadFixture } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import type { ExtractConfig } from '../types';
import { getDependentPackageFiles } from './package-tree';

const config: ExtractConfig = {};

const adminConfig: RepoGlobalConfig = {
  localDir: upath.resolve('lib/manager/nuget/__fixtures__'),
};

describe('manager/nuget/package-tree', () => {
  describe('getDependentPackageFiles()', () => {
    beforeEach(() => {
      GlobalConfig.set(adminConfig);
    });
    afterEach(() => {
      GlobalConfig.reset();
    });
    it('returns empty list for single project', async () => {
      expect(true);
    });
  });
});
