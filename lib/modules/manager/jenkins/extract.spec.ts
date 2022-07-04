import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const invalidYamlFile = Fixtures.get('invalid.yaml');

const pluginsTextFile = Fixtures.get('plugins.txt');
const pluginsYamlFile = Fixtures.get('plugins.yaml');

const pluginsEmptyTextFile = Fixtures.get('empty.txt');
const pluginsEmptyYamlFile = Fixtures.get('empty.yaml');

describe('modules/manager/jenkins/extract', () => {
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
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(6);
    });

    it('extracts multiple image lines in yaml format', () => {
      const res = extractPackageFile(pluginsYamlFile, 'path/file.yml');
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(8);
    });
  });
});
