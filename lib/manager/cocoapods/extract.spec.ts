import { getName, loadFixture } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import { extractPackageFile } from '.';

const simplePodfile = loadFixture('Podfile.simple');
const complexPodfile = loadFixture('Podfile.complex');

const adminConfig: RepoGlobalConfig = {
  localDir: '',
};

describe(getName(), () => {
  describe('extractPackageFile()', () => {
    it('extracts all dependencies', async () => {
      setGlobalConfig(adminConfig);
      const simpleResult = (await extractPackageFile(simplePodfile, 'Podfile'))
        .deps;
      // FIXME: explicit assert condition
      expect(simpleResult).toMatchSnapshot();

      // TODO: split test
      const complexResult = (
        await extractPackageFile(complexPodfile, 'Podfile')
      ).deps;
      // FIXME: explicit assert condition
      expect(complexResult).toMatchSnapshot();
    });
  });
});
