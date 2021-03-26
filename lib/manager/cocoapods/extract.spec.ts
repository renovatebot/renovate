import fs from 'fs-extra';
import upath from 'upath';

import { extractPackageFile } from '.';

const simplePodfile = fs.readFileSync(
  upath.resolve(__dirname, './__fixtures__/Podfile.simple'),
  'utf-8'
);

const complexPodfile = fs.readFileSync(
  upath.resolve(__dirname, './__fixtures__/Podfile.complex'),
  'utf-8'
);

describe('lib/manager/cocoapods/extract', () => {
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
