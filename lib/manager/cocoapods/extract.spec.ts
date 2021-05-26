import { getName, loadFixture } from '../../../test/util';
import { setAdminConfig } from '../../config/admin';
import type { RepoAdminConfig } from '../../config/types';
import { extractPackageFile } from '.';

const simplePodfile = loadFixture('Podfile.simple');
const complexPodfile = loadFixture('Podfile.complex');

const adminConfig: RepoAdminConfig = {
  localDir: '',
};

describe(getName(), () => {
  describe('extractPackageFile()', () => {
    it('extracts all dependencies', async () => {
      setAdminConfig(adminConfig);
      const simpleResult = (await extractPackageFile(simplePodfile, 'Podfile'))
        .deps;
      expect(simpleResult).toMatchSnapshot();

      const complexResult = (
        await extractPackageFile(complexPodfile, 'Podfile')
      ).deps;
      expect(complexResult).toMatchSnapshot();
    });
  });
});
