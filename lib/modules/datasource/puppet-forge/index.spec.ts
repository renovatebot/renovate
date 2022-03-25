import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { loadFixture } from '../../../../test/util';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { PuppetForgeDatasource } from '.';

const puppetforgeReleases = loadFixture('puppetforge-response.json');
const puppetforgeReleasesNulls = loadFixture(
  'puppetforge-response-with-nulls.json'
);

const datasource = PuppetForgeDatasource.id;

describe('modules/datasource/puppet-forge/index', () => {
  describe('getReleases', () => {
    it('should use default forge if no other provided', async () => {
      httpMock
        .scope('https://forgeapi.puppet.com')
        .get('/v3/modules/puppetlabs-apache')
        .query({ exclude_fields: 'current_release' })
        .reply(200, puppetforgeReleases);

      const res = await getPkgReleases({
        datasource,
        depName: 'puppetlabs/apache',
        packageName: 'puppetlabs/apache',
      });
      expect(res).toBeDefined();
      expect(res.registryUrl).toBe('https://forgeapi.puppet.com');
    });

    it('parses real data', async () => {
      httpMock
        .scope('https://forgeapi.puppet.com')
        .get('/v3/modules/puppetlabs-apache')
        .query({ exclude_fields: 'current_release' })
        .reply(200, puppetforgeReleases);

      const res = await getPkgReleases({
        datasource,
        depName: 'puppetlabs/apache',
        packageName: 'puppetlabs/apache',
        registryUrls: ['https://forgeapi.puppet.com'],
      });

      expect(res).toEqual({
        registryUrl: 'https://forgeapi.puppet.com',
        releases: [
          {
            downloadUrl: '/v3/files/puppetlabs-apache-6.4.0.tar.gz',
            registryUrl: 'https://forgeapi.puppet.com',
            releaseTimestamp: '2021-08-02T13:49:41.000Z',
            version: '6.4.0',
          },
          {
            downloadUrl: '/v3/files/puppetlabs-apache-6.5.0.tar.gz',
            registryUrl: 'https://forgeapi.puppet.com',
            releaseTimestamp: '2021-08-24T15:20:22.000Z',
            version: '6.5.0',
          },
          {
            downloadUrl: '/v3/files/puppetlabs-apache-6.5.1.tar.gz',
            registryUrl: 'https://forgeapi.puppet.com',
            releaseTimestamp: '2021-08-25T11:16:27.000Z',
            version: '6.5.1',
          },
          {
            downloadUrl: '/v3/files/puppetlabs-apache-7.0.0.tar.gz',
            registryUrl: 'https://forgeapi.puppet.com',
            releaseTimestamp: '2021-10-11T14:47:24.000Z',
            version: '7.0.0',
          },
        ],
        sourceUrl: 'https://github.com/puppetlabs/puppetlabs-apache',
        tags: {
          endorsement: 'supported',
          moduleGroup: 'base',
          premium: 'false',
        },
      });
    });
  });

  // https://forgeapi.puppet.com/#operation/getModule
  it('should return null if lookup fails 400', async () => {
    httpMock
      .scope('https://forgeapi.puppet.com')
      .get('/v3/modules/foobar')
      .query({ exclude_fields: 'current_release' })
      .reply(400);

    await expect(
      getPkgReleases({
        datasource,
        depName: 'foobar',
        registryUrls: ['https://forgeapi.puppet.com'],
      })
    ).rejects.toThrow(ExternalHostError);
  });

  // https://forgeapi.puppet.com/#operation/getModule
  it('should return null if lookup fails', async () => {
    httpMock
      .scope('https://forgeapi.puppet.com')
      .get('/v3/modules/foobar')
      .query({ exclude_fields: 'current_release' })
      .reply(404);
    const res = await getPkgReleases({
      datasource,
      depName: 'foobar',
      registryUrls: ['https://forgeapi.puppet.com'],
    });
    expect(res).toBeNull();
  });

  it('should fetch package info from custom registry', async () => {
    httpMock
      .scope('https://puppet.mycustomregistry.com', {})
      .get('/v3/modules/foobar')
      .query({ exclude_fields: 'current_release' })
      .reply(200, puppetforgeReleases);
    const registryUrls = ['https://puppet.mycustomregistry.com'];
    const res = await getPkgReleases({
      datasource,
      depName: 'foobar',
      registryUrls,
    });

    expect(res).toEqual({
      registryUrl: 'https://puppet.mycustomregistry.com',
      releases: [
        {
          downloadUrl: '/v3/files/puppetlabs-apache-6.4.0.tar.gz',
          registryUrl: 'https://puppet.mycustomregistry.com',
          releaseTimestamp: '2021-08-02T13:49:41.000Z',
          version: '6.4.0',
        },
        {
          downloadUrl: '/v3/files/puppetlabs-apache-6.5.0.tar.gz',
          registryUrl: 'https://puppet.mycustomregistry.com',
          releaseTimestamp: '2021-08-24T15:20:22.000Z',
          version: '6.5.0',
        },
        {
          downloadUrl: '/v3/files/puppetlabs-apache-6.5.1.tar.gz',
          registryUrl: 'https://puppet.mycustomregistry.com',
          releaseTimestamp: '2021-08-25T11:16:27.000Z',
          version: '6.5.1',
        },
        {
          downloadUrl: '/v3/files/puppetlabs-apache-7.0.0.tar.gz',
          registryUrl: 'https://puppet.mycustomregistry.com',
          releaseTimestamp: '2021-10-11T14:47:24.000Z',
          version: '7.0.0',
        },
      ],
      sourceUrl: 'https://github.com/puppetlabs/puppetlabs-apache',
      tags: {
        endorsement: 'supported',
        moduleGroup: 'base',
        premium: 'false',
      },
    });
  });

  it('load all possible null values', async () => {
    httpMock
      .scope('https://forgeapi.puppet.com', {})
      .get('/v3/modules/foobar')
      .query({ exclude_fields: 'current_release' })
      .reply(200, puppetforgeReleasesNulls);

    const res = await getPkgReleases({
      datasource,
      depName: 'foobar',
    });

    expect(res).toEqual({
      registryUrl: 'https://forgeapi.puppet.com',
      releases: [
        {
          downloadUrl: '/v3/files/puppetlabs-apache-7.0.0.tar.gz',
          registryUrl: 'https://forgeapi.puppet.com',
          releaseTimestamp: '2021-10-11T14:47:24.000Z',
          version: '7.0.0',
        },
      ],
      sourceUrl: 'https://github.com/puppetlabs/puppetlabs-apache',
      tags: {
        moduleGroup: 'base',
        premium: 'false',
      },
    });
  });
});
