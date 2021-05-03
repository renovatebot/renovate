import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from '.';

const simplePodfile = loadFixture('Podfile.simple');
const complexPodfile = loadFixture('Podfile.complex');

describe(getName(), () => {
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
