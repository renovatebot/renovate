import { getPkgReleases } from '../index';
import { KubernetesApiDatasource } from '.';

const datasource = KubernetesApiDatasource.id;

describe('modules/datasource/kubernetes-api/index', () => {
  describe('getReleases', () => {
    it('returns null for an unknown Kubernetes API type', async () => {
      const res = await getPkgReleases({ datasource, depName: 'Unknown' });
      expect(res).toBeNull();
    });

    it('returns for a known Kubernetes API type', async () => {
      const res = await getPkgReleases({
        datasource,
        depName: 'CSIStorageCapacity',
      });
      expect(res).not.toBeNull();
      expect(res).toStrictEqual({
        releases: [
          { version: 'storage.k8s.io/v1beta1' },
          { version: 'storage.k8s.io/v1' },
        ],
      });
    });

    it('is case sensitive', async () => {
      const res = await getPkgReleases({
        datasource,
        depName: 'csistoragecapacity',
      });
      expect(res).toBeNull();
    });
  });
});
