import { getPkgReleases } from '../index';
import { KubernetesApiDatasource } from '.';

const datasource = KubernetesApiDatasource.id;

describe('modules/datasource/kubernetes-api/index', () => {
  describe('getReleases', () => {
    it('returns null for an unknown Kubernetes API type', async () => {
      const res = await getPkgReleases({ datasource, packageName: 'Unknown' });
      expect(res).toBeNull();
    });

    it('returns for a known Kubernetes API type', async () => {
      const res = await getPkgReleases({
        datasource,
        packageName: 'CSIStorageCapacity',
      });
      expect(res).not.toBeNull();
      expect(res).toEqual({
        releases: [
          { version: 'storage.k8s.io/v1beta1' },
          { version: 'storage.k8s.io/v1' },
        ],
      });
    });

    it('is case sensitive', async () => {
      const res = await getPkgReleases({
        datasource,
        packageName: 'csistoragecapacity',
      });
      expect(res).toBeNull();
    });
  });
});
