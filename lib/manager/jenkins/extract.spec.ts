import { readFileSync } from 'fs';
import { getName } from '../../../test/util';
import { extractPackageFile } from './extract';

const pluginsTextFile = readFileSync(
  'lib/manager/jenkins/__fixtures__/plugins.txt',
  'utf8'
);
const pluginsYamlFile = readFileSync(
  'lib/manager/jenkins/__fixtures__/plugins.yaml',
  'utf8'
);

const pluginsEmptyFile = readFileSync(
  'lib/manager/jenkins/__fixtures__/empty.txt',
  'utf8'
);

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns empty list for an empty file', () => {
      const res = extractPackageFile(pluginsEmptyFile);
      expect(res.deps).toHaveLength(0);
    });

    it('extracts multiple image lines in text format', () => {
      const res = extractPackageFile(pluginsTextFile);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
    });

    it('extracts multiple image lines in yaml format', () => {
      const res = extractPackageFile(pluginsYamlFile);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
    });
  });
});
