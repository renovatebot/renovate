import fs from 'fs-extra';
import path from 'path';
import { extractPackageFile } from '../../../lib/manager/cocoapods';

const sample = fs.readFileSync(
  path.resolve(__dirname, './_fixtures/Podfile'),
  'utf-8'
);

describe('lib/manager/cocoapods/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts all dependencies', () => {
      const res = extractPackageFile(sample).deps;
      expect(res).toMatchSnapshot();
    });
  });
});
