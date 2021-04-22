import { readFileSync } from 'fs';
import { testName } from '../../../test/util';
import { extractPackageFile } from './extract';

const content = readFileSync(
  'lib/manager/setup-cfg/__fixtures__/setup-cfg-1.txt',
  'utf8'
);

describe(testName(), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts dependencies', () => {
      const res = extractPackageFile(content);
      expect(res).toMatchSnapshot();
    });
  });
});
