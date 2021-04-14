import { readFileSync } from 'fs';
import { getName } from '../../../test/util';
import extractPackageFile from './extract';

const yamlFile1 = readFileSync(
  'lib/manager/ansible/__fixtures__/main1.yaml',
  'utf8'
);
const yamlFile2 = readFileSync(
  'lib/manager/ansible/__fixtures__/main2.yaml',
  'utf8'
);

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple image lines from docker_container', () => {
      const res = extractPackageFile(yamlFile1);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(9);
    });
    it('extracts multiple image lines from docker_service', () => {
      const res = extractPackageFile(yamlFile2);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(4);
    });
  });
});
