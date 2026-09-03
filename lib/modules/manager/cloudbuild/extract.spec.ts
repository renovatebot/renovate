import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/cloudbuild/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts multiple image lines', () => {
      const res = extractPackageFile(Fixtures.get('cloudbuild.yml'));
      expect(res?.deps).toMatchObject([
        {
          currentValue: '19.03.8',
          datasource: 'docker',
          depName: 'gcr.io/cloud-builders/docker',
        },
        {
          currentValue: '12',
          datasource: 'docker',
          depName: 'node',
        },
        {
          datasource: 'docker',
          depName: 'gcr.io/cloud-builders/kubectl',
        },
      ]);
      expect(res?.deps).toHaveLength(3);
    });
  });
});
