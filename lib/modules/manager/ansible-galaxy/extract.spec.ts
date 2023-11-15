import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { getSliceEndNumber } from './extract';
import { extractPackageFile } from './';

const yamlFile1 = Fixtures.get('requirements01.yml');
const yamlFile2 = Fixtures.get('requirements02.yml');
const helmRequirements = Fixtures.get('helmRequirements.yml');
const collections1 = Fixtures.get('collections1.yml');
const collections2 = Fixtures.get('collections2.yml');
const galaxy = Fixtures.get('galaxy.yml');

describe('modules/manager/ansible-galaxy/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', 'requirements.yml')).toBeNull();
    });

    it('extracts multiple dependencies from requirements.yml', () => {
      const res = extractPackageFile(yamlFile1, 'requirements.yml');
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(12);
    });

    it('extracts dependencies from a not beautified requirements file', () => {
      const res = extractPackageFile(yamlFile2, 'requirements.yml');
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(2);
    });

    it('extracts dependencies from requirements.yml with a space at the end of line', () => {
      const yamlFile = codeBlock`collections:
      - name: https://github.com/lowlydba/lowlydba.sqlserver.git
      type: git
      version: 1.1.3`;
      const res = extractPackageFile(yamlFile, 'requirements.yml');
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].currentValue).toBe('1.1.3');
    });

    it('extracts git@ dependencies', () => {
      const yamlFile = codeBlock`collections:
      - name: community.docker
        source: git@github.com:ansible-collections/community.docker
        type: git
        version: 2.7.5`;
      const res = extractPackageFile(yamlFile, 'requirements.yml');
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].currentValue).toBe('2.7.5');
      expect(res?.deps[0].registryUrls).toBeUndefined();
      expect(res?.deps[0].packageName).toBe(
        'git@github.com:ansible-collections/community.docker',
      );
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
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(14);
      expect(res?.deps.filter((value) => value.skipReason)).toHaveLength(6);
    });

    it('check collection style requirements file in reverse order and missing empty line', () => {
      const res = extractPackageFile(collections2, 'requirements.yml');
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(4);
    });

    it('check galaxy definition file', () => {
      const res = extractPackageFile(galaxy, 'galaxy.yml');
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(10);
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
      expect(res).toBe(10);
    });
  });
});
