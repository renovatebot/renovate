import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { TerraformModuleDatasource } from '.';

const consulData = Fixtures.get('registry-consul.json');
const consulVersionsData = Fixtures.get('registry-consul-versions.json');
const versionsDataWithSourceUrl = Fixtures.get(
  'registry-versions-with-source.json',
);
const serviceDiscoveryResult = Fixtures.get('service-discovery.json');
const serviceDiscoveryCustomResult = Fixtures.get(
  'service-custom-discovery.json',
);

const datasource = TerraformModuleDatasource.id;
const baseUrl = 'https://registry.terraform.io';
const localTerraformEnterprisebaseUrl = 'https://terraform.foo.bar';

describe('modules/datasource/terraform-module/index', () => {
  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v1/modules/hashicorp/consul/aws')
        .reply(200, {})
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'hashicorp/consul/aws',
        }),
      ).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v1/modules/hashicorp/consul/aws')
        .reply(404, {})
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'hashicorp/consul/aws',
        }),
      ).toBeNull();
    });

    it('returns null for unknown error', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v1/modules/hashicorp/consul/aws')
        .replyWithError('')
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'hashicorp/consul/aws',
        }),
      ).toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v1/modules/hashicorp/consul/aws')
        .reply(200, consulData)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      const res = await getPkgReleases({
        datasource,
        packageName: 'hashicorp/consul/aws',
      });
      expect(res).toEqual({
        homepage: 'https://registry.terraform.io/modules/hashicorp/consul/aws',
        registryUrl: 'https://registry.terraform.io',
        releases: [
          {
            version: '0.3.8',
          },
          {
            version: '0.3.9',
          },
          {
            version: '0.3.10',
          },
          {
            releaseTimestamp: '2018-09-20T11:25:22.957Z',
            version: '0.4.0',
          },
        ],
        sourceUrl: 'https://github.com/hashicorp/terraform-aws-consul',
      });
    });

    it('returns null for empty result from third party', async () => {
      httpMock
        .scope('https://terraform.company.com')
        .get('/v1/modules/hashicorp/consul/aws/versions')
        .reply(200, {})
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'hashicorp/consul/aws',
          registryUrls: ['https://terraform.company.com'],
        }),
      ).toBeNull();
    });

    it('returns null for 404 from third party', async () => {
      httpMock
        .scope('https://terraform.company.com')
        .get('/v1/modules/hashicorp/consul/aws/versions')
        .reply(404, {})
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'hashicorp/consul/aws',
          registryUrls: ['https://terraform.company.com'],
        }),
      ).toBeNull();
    });

    it('returns null for unknown error from third party', async () => {
      httpMock
        .scope('https://terraform.company.com')
        .get('/v1/modules/hashicorp/consul/aws/versions')
        .replyWithError('')
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'hashicorp/consul/aws',
          registryUrls: ['https://terraform.company.com'],
        }),
      ).toBeNull();
    });

    it('processes real data from third party', async () => {
      httpMock
        .scope('https://terraform.company.com')
        .get('/v1/modules/hashicorp/consul/aws/versions')
        .reply(200, consulVersionsData)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      const res = await getPkgReleases({
        datasource,
        packageName: 'hashicorp/consul/aws',
        registryUrls: ['https://terraform.company.com'],
      });
      expect(res).toEqual({
        registryUrl: 'https://terraform.company.com',
        releases: [
          {
            version: '0.0.2',
          },
          {
            version: '0.2.2',
          },
          {
            version: '0.7.1',
          },
          {
            version: '0.7.5',
          },
          {
            version: '0.8.5',
          },
        ],
      });
    });

    it('processes real data from third party including source url', async () => {
      httpMock
        .scope('https://terraform.company.com')
        .get('/v1/modules/renovate-issue-25003/mymodule/local/versions')
        .reply(200, versionsDataWithSourceUrl)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      const res = await getPkgReleases({
        datasource,
        packageName: 'renovate-issue-25003/mymodule/local',
        registryUrls: ['https://terraform.company.com'],
      });
      expect(res).toEqual({
        registryUrl: 'https://terraform.company.com',
        releases: [
          {
            version: '0.0.1',
          },
          {
            version: '0.0.2',
          },
        ],
        sourceUrl: 'https://gitlab.com/renovate-issue-25003/mymodule',
      });
    });

    it('processes with registry in name', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v1/modules/hashicorp/consul/aws')
        .reply(200, consulData)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      const res = await getPkgReleases({
        datasource,
        packageName: 'registry.terraform.io/hashicorp/consul/aws',
      });
      expect(res).toEqual({
        homepage: 'https://registry.terraform.io/modules/hashicorp/consul/aws',
        registryUrl: 'https://registry.terraform.io',
        releases: [
          {
            version: '0.3.8',
          },
          {
            version: '0.3.9',
          },
          {
            version: '0.3.10',
          },
          {
            releaseTimestamp: '2018-09-20T11:25:22.957Z',
            version: '0.4.0',
          },
        ],
        sourceUrl: 'https://github.com/hashicorp/terraform-aws-consul',
      });
    });

    it('rejects mismatch', async () => {
      httpMock
        .scope('https://terraform.company.com')
        .get('/v1/modules/consul/foo/versions')
        .reply(200, {
          modules: [],
        })
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      const res = await getPkgReleases({
        datasource,
        packageName: 'consul/foo',
        registryUrls: ['https://terraform.company.com'],
      });
      expect(res).toBeNull();
    });

    it('rejects missing module data from third party', async () => {
      httpMock
        .scope('https://terraform.company.com')
        .get('/v1/modules/consul/foo/versions')
        .reply(200, {
          modules: [],
        })
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      const res = await getPkgReleases({
        datasource,
        packageName: 'consul/foo',
        registryUrls: ['https://terraform.company.com'],
      });
      expect(res).toBeNull();
    });

    it('rejects servicediscovery', async () => {
      httpMock
        .scope('https://terraform.company.com')
        .get('/.well-known/terraform.json')
        .reply(404);
      const res = await getPkgReleases({
        datasource,
        packageName: 'consul/foo',
        registryUrls: ['https://terraform.company.com'],
      });
      expect(res).toBeNull();
    });

    it('processes real data on changed subpath', async () => {
      httpMock
        .scope(localTerraformEnterprisebaseUrl)
        .get('/api/registry/v1/modules/hashicorp/consul/aws/versions')
        .reply(200, consulVersionsData)
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryCustomResult);
      const res = await getPkgReleases({
        datasource,
        registryUrls: ['https://terraform.foo.bar'],
        packageName: 'hashicorp/consul/aws',
      });

      expect(res).toEqual({
        registryUrl: 'https://terraform.foo.bar',
        releases: [
          {
            version: '0.0.2',
          },
          {
            version: '0.2.2',
          },
          {
            version: '0.7.1',
          },
          {
            version: '0.7.5',
          },
          {
            version: '0.8.5',
          },
        ],
      });
    });
  });
});
