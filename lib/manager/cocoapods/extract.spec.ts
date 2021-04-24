import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from '.';

const simplePodfile = loadFixture(__filename, 'Podfile.simple');
const complexPodfile = loadFixture(__filename, 'Podfile.complex');

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('extracts all dependencies', async () => {
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
