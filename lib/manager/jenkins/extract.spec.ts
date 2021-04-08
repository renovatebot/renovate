import { readFileSync } from 'fs';
import { getName } from '../../../test/util';
import { extractPackageFile } from './extract';

const invalidYamlFile = readFileSync(
  'lib/manager/jenkins/__fixtures__/invalid.yaml',
  'utf8'
);

const pluginsTextFile = readFileSync(
  'lib/manager/jenkins/__fixtures__/plugins.txt',
  'utf8'
);
const pluginsYamlFile = readFileSync(
  'lib/manager/jenkins/__fixtures__/plugins.yaml',
  'utf8'
);

const pluginsEmptyTextFile = readFileSync(
  'lib/manager/jenkins/__fixtures__/empty.txt',
  'utf8'
);
const pluginsEmptyYamlFile = readFileSync(
  'lib/manager/jenkins/__fixtures__/empty.yaml',
  'utf8'
);

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns empty list for an empty text file', () => {
      const res = extractPackageFile(pluginsEmptyTextFile, 'path/file.txt');
      expect(res).toBeNull();
    });

    it('returns empty list for an empty yaml file', () => {
      const res = extractPackageFile(pluginsEmptyYamlFile, 'path/file.yaml');
      expect(res).toBeNull();
    });

    it('returns empty list for an invalid yaml file', () => {
      const res = extractPackageFile(invalidYamlFile, 'path/file.yaml');
      expect(res).toBeNull();
    });

    it('extracts multiple image lines in text format', () => {
      const res = extractPackageFile(pluginsTextFile, 'path/file.txt');
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
    });

    it('extracts multiple image lines in yaml format', () => {
      const res = extractPackageFile(pluginsYamlFile, 'path/file.yml');
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(8);
    });
  });
});
