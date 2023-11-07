import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { datasource, defaultRegistryUrl } from './common';

describe('modules/datasource/hexpm-bob/index', () => {
  describe('getReleases', () => {
    it('throws for error', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/elixir/builds.txt')
        .replyWithError('error');
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'elixir',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for 404', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/elixir/builds.txt')
        .reply(404);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'elixir',
        }),
      ).toBeNull();
    });

    it('returns null for empty result', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/elixir/builds.txt')
        .reply(200, '');
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'elixir',
        }),
      ).toBeNull();
    });

    it('returns empty list for empty 200 OK', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/elixir/builds.txt')
        .reply(200, '');
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'elixir',
        }),
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/elixir/builds.txt')
        .reply(502);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'elixir',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes real data', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/elixir/builds.txt')
        .reply(200, Fixtures.get('elixir/builds.txt'));
      const res = await getPkgReleases({
        datasource,
        packageName: 'elixir',
      });
      expect(res).toEqual({
        homepage: 'https://elixir-lang.org/',
        registryUrl: 'https://builds.hex.pm',
        releases: [
          {
            gitRef: '185eeec5ecbc2a0c8d9b8b97cb2d23108615ffdb',
            isStable: false,
            releaseTimestamp: '2022-08-15T10:28:05.000Z',
            version: '1.14.0-rc.1',
          },
          {
            gitRef: '185eeec5ecbc2a0c8d9b8b97cb2d23108615ffdb',
            isStable: false,
            releaseTimestamp: '2022-08-15T10:25:05.000Z',
            version: '1.14.0-rc.1-otp-25',
          },
          {
            gitRef: 'c5151e6890b5ac8df13276459696f0f47a8e634b',
            isStable: true,
            releaseTimestamp: '2022-09-01T18:24:21.000Z',
            version: '1.14.0',
          },
          {
            gitRef: 'a285e5876b6f69e7c340d04851aae63c8a32bf1d',
            isStable: true,
            releaseTimestamp: '2022-10-10T22:26:05.000Z',
            version: '1.14.1-otp-25',
          },
          {
            gitRef: 'a285e5876b6f69e7c340d04851aae63c8a32bf1d',
            isStable: true,
            releaseTimestamp: '2022-10-10T22:27:46.000Z',
            version: '1.14.1',
          },
        ],
        sourceUrl: 'https://github.com/elixir-lang/elixir',
      });
    });

    it('processes real data (erlang / ubuntu 20.04)', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/otp/ubuntu-20.04/builds.txt')
        .reply(200, Fixtures.get('otp/ubuntu-20.04/builds.txt'));
      const res = await getPkgReleases({
        datasource,
        packageName: 'otp/ubuntu-20.04',
        versioning:
          'regex:^(?<major>\\d+?)\\.(?<minor>\\d+?)(\\.(?<patch>\\d+))?$',
      });

      expect(res).toEqual({
        homepage: 'https://www.erlang.org/',
        registryUrl: 'https://builds.hex.pm',
        releases: [
          {
            gitRef: '6efb5e31df6bc512ed6c466584ef15b846dcecab',
            isStable: true,
            releaseTimestamp: '2022-09-21T09:54:48.000Z',
            version: '25.1',
          },
          {
            gitRef: '38ad8e28421c745c06ef9bd55f6e6204cd1f15ef',
            isStable: true,
            releaseTimestamp: '2022-10-24T13:23:18.000Z',
            version: '25.1.2',
          },
        ],
        sourceUrl: 'https://github.com/erlang/otp',
      });
    });

    it('can override registry url', async () => {
      const registryUrl = 'https://repo.example.com/';

      httpMock
        .scope(registryUrl)
        .get('/builds/otp/ubuntu-20.04/builds.txt')
        .reply(200, Fixtures.get('otp/ubuntu-20.04/builds.txt'));

      const res = await getPkgReleases({
        datasource,
        packageName: 'otp/ubuntu-20.04',
        registryUrls: [registryUrl],
      });

      expect(res?.releases).toHaveLength(1);
    });

    it('returns empty list for invalid package name', async () => {
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'invalid',
        }),
      ).toBeNull();
    });
  });
});
