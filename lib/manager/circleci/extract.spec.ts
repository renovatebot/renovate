import { readFileSync } from 'fs';
import { getName } from '../../../test/util';
import { extractPackageFile } from './extract';

const file1 = readFileSync(
  'lib/manager/circleci/__fixtures__/config.yml',
  'utf8'
);
const file2 = readFileSync(
  'lib/manager/circleci/__fixtures__/config2.yml',
  'utf8'
);
const file3 = readFileSync(
  'lib/manager/circleci/__fixtures__/config3.yml',
  'utf8'
);

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple image lines', () => {
      const res = extractPackageFile(file1);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(4);
    });
    it('extracts orbs too', () => {
      const res = extractPackageFile(file2);
      expect(res.deps).toMatchSnapshot();
      // expect(res.deps).toHaveLength(4);
    });
    it('extracts image without leading dash', () => {
      const res = extractPackageFile(file3);
      expect(res.deps).toMatchSnapshot();
    });
  });
});
