import { readFileSync } from 'fs';
import { getName } from '../../../test/util';
import extractPackageFile, { getSliceEndNumber } from './extract';

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
const collections1 = readFileSync(
  'lib/manager/ansible-galaxy/__fixtures__/collections1.yml',
  'utf8'
);
const collections2 = readFileSync(
  'lib/manager/ansible-galaxy/__fixtures__/collections2.yml',
  'utf8'
);
const galaxy = readFileSync(
  'lib/manager/ansible-galaxy/__fixtures__/galaxy.yml',
  'utf8'
);

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', 'requirements.yml')).toBeNull();
    });
    it('extracts multiple dependencies from requirements.yml', () => {
      const res = extractPackageFile(yamlFile1, 'requirements.yml');
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(12);
    });
    it('extracts dependencies from a not beautified requirements file', () => {
      const res = extractPackageFile(yamlFile2, 'requirements.yml');
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });
    it('check if an empty file returns null', () => {
      const res = extractPackageFile('\n', 'requirements.yml');
      expect(res).toBeNull();
    });
    it('check if a requirements file of other systems returns null', () => {
      const res = extractPackageFile(helmRequirements, 'requirements.yml');
      expect(res).toBeNull();
    });
    it('check collection style requirements file', () => {
      const res = extractPackageFile(collections1, 'requirements.yml');
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(13);
      expect(res.deps.filter((value) => value.skipReason != null)).toHaveLength(
        6
      );
    });
    it('check collection style requirements file in reverse order and missing empty line', () => {
      const res = extractPackageFile(collections2, 'requirements.yml');
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(4);
    });
    it('check galaxy definition file', () => {
      const res = extractPackageFile(galaxy, 'galaxy.yml');
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });
  });
  describe('getSliceEndNumber()', () => {
    it('negative start number returns -1', () => {
      const res = getSliceEndNumber(-1, 10, 5);
      expect(res).toBe(-1);
    });
    it('a start number bigger then number of lines return -1', () => {
      const res = getSliceEndNumber(20, 10, 5);
      expect(res).toBe(-1);
    });
    it('choose first block', () => {
      const res = getSliceEndNumber(0, 10, 5);
      expect(res).toBe(5);
    });
    it('choose second block', () => {
      const res = getSliceEndNumber(5, 10, 5);
      expect(res).toBe(9);
    });
  });
});
