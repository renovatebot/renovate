import * as httpMock from '~test/http-mock.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { AzureComputeGalleryDatasource } from './index.ts';

const azureHost = 'https://management.azure.com';
const packageName = JSON.stringify({
  subscriptionId: '00000000-0000-0000-0000-000000000000',
  resourceGroupName: 'rg-renovate',
  galleryName: 'renovateGallery',
  galleryImageName: 'ubuntu-2204',
});
const versionsPath =
  '/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-renovate/providers/Microsoft.Compute/galleries/renovateGallery/images/ubuntu-2204/versions';

function createDatasource(
  token = 'azure-token',
): AzureComputeGalleryDatasource {
  return new AzureComputeGalleryDatasource({
    getToken: vi.fn().mockResolvedValue({ token }),
  });
}

describe('modules/datasource/azure-compute-gallery/index', () => {
  it('returns null when packageName is invalid', async () => {
    const res = await createDatasource().getReleases({
      packageName: '{not-json}',
    });

    expect(res).toBeNull();
  });

  it('throws when Azure credential returns no access token', async () => {
    const datasource = new AzureComputeGalleryDatasource({
      getToken: vi.fn().mockResolvedValue(null),
    });

    await expect(datasource.getReleases({ packageName })).rejects.toThrow(
      'Failed to get Azure access token',
    );
  });

  it('returns non-excluded gallery image versions', async () => {
    httpMock
      .scope(azureHost, {
        reqheaders: { authorization: 'Bearer azure-token' },
      })
      .get(versionsPath)
      .query({ 'api-version': '2025-03-03' })
      .reply(200, {
        value: [
          {
            name: '1.0.0',
            properties: {
              publishingProfile: {
                publishedDate: '2024-01-02T03:04:05Z',
                excludeFromLatest: false,
              },
            },
          },
          {
            name: '1.1.0',
            properties: {
              publishingProfile: {
                excludeFromLatest: true,
              },
            },
          },
          {
            name: '26.03.27093731',
            properties: {
              publishingProfile: {},
            },
          },
        ],
      });

    await expect(
      createDatasource().getReleases({ packageName }),
    ).resolves.toEqual({
      isPrivate: true,
      releases: [
        {
          version: '1.0.0',
          releaseTimestamp: '2024-01-02T03:04:05.000Z',
        },
        {
          version: '26.03.27093731',
        },
      ],
    });
  });

  it('follows nextLink pagination', async () => {
    httpMock
      .scope(azureHost, {
        reqheaders: { authorization: 'Bearer azure-token' },
      })
      .get(versionsPath)
      .query({ 'api-version': '2025-03-03' })
      .reply(200, {
        value: [
          {
            name: '1.0.0',
            properties: {
              publishingProfile: {
                excludeFromLatest: false,
              },
            },
          },
        ],
        nextLink: `${azureHost}${versionsPath}?api-version=2025-03-03&$skiptoken=next`,
      })
      .get(versionsPath)
      .query({ 'api-version': '2025-03-03', $skiptoken: 'next' })
      .reply(200, {
        value: [
          {
            name: '2.0.0',
            properties: {
              publishingProfile: {
                excludeFromLatest: false,
              },
            },
          },
        ],
      });

    await expect(
      createDatasource().getReleases({ packageName }),
    ).resolves.toEqual({
      isPrivate: true,
      releases: [{ version: '1.0.0' }, { version: '2.0.0' }],
    });
  });

  it('uses the registry URL as token scope for custom Azure clouds', async () => {
    const credential = {
      getToken: vi.fn().mockResolvedValue({ token: 'gov' }),
    };
    const datasource = new AzureComputeGalleryDatasource(credential);
    const registryUrl = 'https://management.usgovcloudapi.net';

    httpMock
      .scope(registryUrl, {
        reqheaders: { authorization: 'Bearer gov' },
      })
      .get(versionsPath)
      .query({ 'api-version': '2025-03-03' })
      .reply(200, {
        value: [
          {
            name: '1.0.0',
            properties: {
              publishingProfile: {
                excludeFromLatest: false,
              },
            },
          },
        ],
      });

    await datasource.getReleases({ packageName, registryUrl });

    expect(credential.getToken).toHaveBeenCalledWith(
      'https://management.usgovcloudapi.net/.default',
    );
  });

  it('uses the default Azure management token scope', async () => {
    const credential = {
      getToken: vi.fn().mockResolvedValue({ token: 'azure-token' }),
    };
    const datasource = new AzureComputeGalleryDatasource(credential);

    httpMock
      .scope(azureHost, {
        reqheaders: { authorization: 'Bearer azure-token' },
      })
      .get(versionsPath)
      .query({ 'api-version': '2025-03-03' })
      .reply(200, {
        value: [
          {
            name: '1.0.0',
            properties: {
              publishingProfile: {},
            },
          },
        ],
      });

    await datasource.getReleases({ packageName });

    expect(credential.getToken).toHaveBeenCalledWith(
      'https://management.azure.com/.default',
    );
  });

  it('returns null for empty responses', async () => {
    httpMock
      .scope(azureHost, {
        reqheaders: { authorization: 'Bearer azure-token' },
      })
      .get(versionsPath)
      .query({ 'api-version': '2025-03-03' })
      .reply(200, { value: [] });

    await expect(
      createDatasource().getReleases({ packageName }),
    ).resolves.toBeNull();
  });

  it.each([429, 500])(
    'throws ExternalHostError for HTTP %s responses',
    async (statusCode) => {
      httpMock
        .scope(azureHost, {
          reqheaders: { authorization: 'Bearer azure-token' },
        })
        .get(versionsPath)
        .query({ 'api-version': '2025-03-03' })
        .reply(statusCode);

      await expect(
        createDatasource().getReleases({ packageName }),
      ).rejects.toThrow(ExternalHostError);
    },
  );
});
