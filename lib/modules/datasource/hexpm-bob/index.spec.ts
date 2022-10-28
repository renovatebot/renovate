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
          depName: 'elixir',
        })
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
          depName: 'elixir',
        })
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
          depName: 'elixir',
        })
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
          depName: 'elixir',
        })
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
          depName: 'elixir',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes real data', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/elixir/builds.txt')
        .reply(200, Fixtures.get('elixir/builds.txt'));
      const res = await getPkgReleases({
        datasource,
        depName: 'elixir',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(16);
    });

    it('processes real data (erlang / ubuntu 20.04)', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/builds/otp/ubuntu-20.04/builds.txt')
        .reply(200, Fixtures.get('otp/ubuntu-20.04/builds.txt'));
      const res = await getPkgReleases({
        datasource,
        depName: 'otp/ubuntu-20.04',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(6);
    });

    it('can override registry url', async () => {
      const registryUrl = 'https://repo.example.com/';

      httpMock
        .scope(registryUrl)
        .get('/builds/otp/ubuntu-20.04/builds.txt')
        .reply(200, Fixtures.get('otp/ubuntu-20.04/builds.txt'));

      const res = await getPkgReleases({
        datasource,
        depName: 'otp/ubuntu-20.04',
        registryUrls: [registryUrl],
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(6);
    });

    it('returns empty list for invalid package name', async () => {
      expect(
        await getPkgReleases({
          datasource,
          depName: 'invalid',
        })
      ).toBeNull();
    });
  });
});
