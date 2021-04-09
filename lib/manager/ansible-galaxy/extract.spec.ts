import { readFileSync } from 'fs';
import extractPackageFile from './extract';

const yamlFile1 = readFileSync(
  'lib/manager/ansible-galaxy/__fixtures__/requirements01.yml',
  'utf8'
);
const yamlFile2 = readFileSync(
  'lib/manager/ansible-galaxy/__fixtures__/requirements02.yml',
  'utf8'
);
const helmRequirements = readFileSync(
  'lib/manager/ansible-galaxy/__fixtures__/helmRequirements.yml',
  'utf8'
);

describe('lib/manager/ansible-galaxy/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple dependencies from requirements.yml', () => {
      const res = extractPackageFile(yamlFile1);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(12);
    });
    it('extracts dependencies from a not beautified requirements file', () => {
      const res = extractPackageFile(yamlFile2);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });
    it('check if an empty file returns null', () => {
      const res = extractPackageFile('\n');
      expect(res).toBeNull();
    });
    it('check if a requirements file of other systems returns null', () => {
      const res = extractPackageFile(helmRequirements);
      expect(res).toBeNull();
    });
  });
});
