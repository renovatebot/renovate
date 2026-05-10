import * as httpMock from '~test/http-mock.ts';
import { getPkgReleases } from '../index.ts';
import { TerraformModuleDatasource } from './index.ts';

const serviceDiscoveryResult = {
  'modules.v1': '/v1/modules/',
};

const registryModuleV2Response = {
  data: {
    attributes: {
      source: 'https://github.com/hashicorp/terraform-aws-consul',
    },
  },
  included: [
    {
      type: 'module-versions',
      attributes: {
        version: '0.3.8',
        'published-at': '2018-08-21T22:26:36Z',
      },
    },
    {
      type: 'module-versions',
      attributes: {
        version: '0.4.0',
        'published-at': '2018-09-20T11:25:22Z',
      },
    },
  ],
};

const moduleVersionsResponse = {
  modules: [{ versions: [{ version: '0.8.5' }] }],
};

const datasource = TerraformModuleDatasource.id;
const baseUrl = TerraformModuleDatasource.terraformRegistryUrl;

type MockVariant = 'empty' | '404' | 'error';

function mockDefaultRegistryLookup(variant: MockVariant): void {
  const registryScope = httpMock
    .scope(baseUrl)
    .get('/v2/modules/hashicorp/consul/aws')
    .query({ include: 'module-versions' });

  if (variant === 'empty') {
    registryScope.reply(200, {});
    return;
  }
  if (variant === '404') {
    registryScope.reply(404, {});
    return;
  }
  registryScope.replyWithError('');
}

function mockThirdPartyRegistryLookup(variant: MockVariant): void {
  httpMock
    .scope('https://terraform.company.com')
    .get('/.well-known/terraform.json')
    .reply(200, serviceDiscoveryResult);
  const registryScope = httpMock
    .scope('https://terraform.company.com')
    .get('/v1/modules/hashicorp/consul/aws/versions');

  if (variant === 'empty') {
    registryScope.reply(200, {});
    return;
  }
  if (variant === '404') {
    registryScope.reply(404, {});
    return;
  }
  registryScope.replyWithError('');
}

describe('modules/datasource/terraform-module/index', () => {
  describe('getReleases', () => {
    it.each`
      description           | variant
      ${'an empty payload'} | ${'empty'}
      ${'a 404 response'}   | ${'404'}
      ${'a request error'}  | ${'error'}
    `(
      'returns null for the default registry when the module endpoint returns $description',
      async ({ variant }) => {
        mockDefaultRegistryLookup(variant);

        expect(
          await getPkgReleases({
            datasource,
            packageName: 'hashicorp/consul/aws',
          }),
        ).toBeNull();
      },
    );

    it('returns releases, homepage, and source URL from the default registry', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v2/modules/hashicorp/consul/aws')
        .query({ include: 'module-versions' })
        .reply(200, registryModuleV2Response);
      const res = await getPkgReleases({
        datasource,
        packageName: 'hashicorp/consul/aws',
      });
      expect(res).toEqual({
        homepage: 'https://registry.terraform.io/modules/hashicorp/consul/aws',
        registryUrl: 'https://registry.terraform.io',
        releases: [
          {
            releaseTimestamp: '2018-08-21T22:26:36.000Z',
            version: '0.3.8',
          },
          {
            releaseTimestamp: '2018-09-20T11:25:22.000Z',
            version: '0.4.0',
          },
        ],
        sourceUrl: 'https://github.com/hashicorp/terraform-aws-consul',
      });
    });

    it.each`
      description           | variant
      ${'an empty payload'} | ${'empty'}
      ${'a 404 response'}   | ${'404'}
      ${'a request error'}  | ${'error'}
    `(
      'returns null for a third-party registry when the versions endpoint returns $description',
      async ({ variant }) => {
        mockThirdPartyRegistryLookup(variant);

        expect(
          await getPkgReleases({
            datasource,
            packageName: 'hashicorp/consul/aws',
            registryUrls: ['https://terraform.company.com'],
          }),
        ).toBeNull();
      },
    );

    it('returns releases from a third-party registry', async () => {
      httpMock
        .scope('https://terraform.company.com')
        .get('/v1/modules/hashicorp/consul/aws/versions')
        .reply(200, moduleVersionsResponse)
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
            version: '0.8.5',
          },
        ],
      });
    });

    it('returns sourceUrl when a third-party registry includes one', async () => {
      httpMock
        .scope('https://terraform.company.com')
        .get('/v1/modules/renovate-issue-25003/mymodule/local/versions')
        .reply(200, {
          modules: [
            {
              versions: [{ version: '0.0.2' }],
              source: 'https://gitlab.com/renovate-issue-25003/mymodule',
            },
          ],
        })
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
            version: '0.0.2',
          },
        ],
        sourceUrl: 'https://gitlab.com/renovate-issue-25003/mymodule',
      });
    });

    it('uses the registry embedded in packageName', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v2/modules/hashicorp/consul/aws')
        .query({ include: 'module-versions' })
        .reply(200, registryModuleV2Response);
      const res = await getPkgReleases({
        datasource,
        packageName: 'registry.terraform.io/hashicorp/consul/aws',
      });
      expect(res).toEqual({
        homepage: 'https://registry.terraform.io/modules/hashicorp/consul/aws',
        registryUrl: 'https://registry.terraform.io',
        releases: [
          {
            releaseTimestamp: '2018-08-21T22:26:36.000Z',
            version: '0.3.8',
          },
          {
            releaseTimestamp: '2018-09-20T11:25:22.000Z',
            version: '0.4.0',
          },
        ],
        sourceUrl: 'https://github.com/hashicorp/terraform-aws-consul',
      });
    });

    it('uses the v1 extended endpoint for Terraform Cloud', async () => {
      const cloudUrl = TerraformModuleDatasource.terraformCloudUrl;
      httpMock
        .scope(cloudUrl)
        .get('/v1/modules/hashicorp/consul/aws')
        .reply(200, {
          source: 'https://github.com/hashicorp/terraform-aws-consul',
          versions: ['0.3.8', '0.4.0'],
          version: '0.4.0',
          published_at: '2018-09-20T11:25:22.957Z',
        })
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult);
      const res = await getPkgReleases({
        datasource,
        packageName: 'hashicorp/consul/aws',
        registryUrls: [cloudUrl],
      });
      expect(res).toEqual({
        homepage: 'https://app.terraform.io/modules/hashicorp/consul/aws',
        registryUrl: 'https://app.terraform.io',
        releases: [
          {
            version: '0.3.8',
          },
          {
            releaseTimestamp: '2018-09-20T11:25:22.957Z',
            version: '0.4.0',
          },
        ],
        sourceUrl: 'https://github.com/hashicorp/terraform-aws-consul',
      });
    });

    it('returns null when the third-party versions response has no modules', async () => {
      httpMock
        .scope('https://terraform.company.com')
        .get('/.well-known/terraform.json')
        .reply(200, serviceDiscoveryResult)
        .get('/v1/modules/consul/foo/versions')
        .reply(200, {
          modules: [],
        });
      const res = await getPkgReleases({
        datasource,
        packageName: 'consul/foo',
        registryUrls: ['https://terraform.company.com'],
      });
      expect(res).toBeNull();
    });

    it('returns null when service discovery fails', async () => {
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

    it('uses the service discovery modules path when the registry serves a custom subpath', async () => {
      httpMock
        .scope('https://terraform.foo.bar')
        .get('/.well-known/terraform.json')
        .reply(200, { 'modules.v1': '/api/registry/v1/modules/' })
        .get('/api/registry/v1/modules/hashicorp/consul/aws/versions')
        .reply(200, moduleVersionsResponse);
      const res = await getPkgReleases({
        datasource,
        registryUrls: ['https://terraform.foo.bar'],
        packageName: 'hashicorp/consul/aws',
      });

      expect(res).toEqual({
        registryUrl: 'https://terraform.foo.bar',
        releases: [
          {
            version: '0.8.5',
          },
        ],
      });
    });

    it('processes real data from OpenTofu registry docs API', async () => {
      httpMock
        .scope('https://api.opentofu.org')
        .get('/registry/docs/modules/terraform-aws-modules/vpc/aws/index.json')
        .reply(200, {
          versions: [
            { id: 'v0.4.0', published: '2018-09-20T11:25:22Z' },
            { id: 'v0.3.8', published: '2018-08-21T22:26:36Z' },
          ],
        });

      const res = await getPkgReleases({
        datasource,
        packageName: 'terraform-aws-modules/vpc/aws',
        registryUrls: ['https://registry.opentofu.org'],
      });

      expect(res).toEqual({
        homepage:
          'https://search.opentofu.org/module/terraform-aws-modules/vpc/aws',
        registryUrl: 'https://registry.opentofu.org',
        sourceUrl: 'https://github.com/terraform-aws-modules/terraform-aws-vpc',
        releases: [
          {
            releaseTimestamp: '2018-08-21T22:26:36.000Z',
            version: '0.3.8',
          },
          {
            releaseTimestamp: '2018-09-20T11:25:22.000Z',
            version: '0.4.0',
          },
        ],
      });
    });

    it('returns an empty release list for OpenTofu registry without versions', async () => {
      httpMock
        .scope('https://api.opentofu.org')
        .get('/registry/docs/modules/terraform-aws-modules/vpc/aws/index.json')
        .reply(200, {});

      expect(
        await getPkgReleases({
          datasource,
          packageName: 'terraform-aws-modules/vpc/aws',
          registryUrls: ['https://registry.opentofu.org'],
        }),
      ).toEqual({
        homepage:
          'https://search.opentofu.org/module/terraform-aws-modules/vpc/aws',
        sourceUrl: 'https://github.com/terraform-aws-modules/terraform-aws-vpc',
        releases: [],
      });
    });
  });
});
