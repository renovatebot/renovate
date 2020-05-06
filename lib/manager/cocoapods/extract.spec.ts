import path from 'path';
import fs from 'fs-extra';
import { extractPackageFile } from '.';

const simplePodfile = fs.readFileSync(
  path.resolve(__dirname, './__fixtures__/Podfile.simple'),
  'utf-8'
);

const complexPodfile = fs.readFileSync(
  path.resolve(__dirname, './__fixtures__/Podfile.complex'),
  'utf-8'
);

describe('lib/manager/cocoapods/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts all dependencies', () => {
      const simpleResult = extractPackageFile(simplePodfile).deps;
      expect(simpleResult).toMatchSnapshot();

      const complexResult = extractPackageFile(complexPodfile).deps;
      expect(complexResult).toMatchSnapshot();
    });
  });
});
