import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

describe('modules/manager/ansible/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts multiple image lines from docker_container', () => {
      const res = extractPackageFile(Fixtures.get('main1.yaml'));
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(9);
    });

    it('extracts multiple image lines from docker_service', () => {
      const res = extractPackageFile(Fixtures.get('main2.yaml'));
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(4);
    });
  });
});
