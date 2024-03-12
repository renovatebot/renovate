import { ZodError } from 'zod';
import * as httpMock from '../../../../test/http-mock';
import { logger } from '../../../../test/util';
import { DenoDatasource } from '.';

describe('modules/datasource/deno/index', () => {
  const deno = new DenoDatasource();

  describe('getReleases', () => {
    it('returns releases of standard library', async () => {
      httpMock
        .scope(deno.defaultRegistryUrls[0])
        .get('/v2/modules/std')
        .reply(200, {
          versions: ['0.163.0', '0.162.0', '0.161.0'],
          tags: [{ value: 'top_5_percent', kind: 'popularity' }],
        })
        .get('/v2/modules/std/0.163.0')
        .reply(200, {
          version: '0.163.0',
          upload_options: {
            repository: 'denoland/deno_std',
            ref: '0.163.0',
            type: 'github',
          },
          uploaded_at: '2022-11-08T21:10:21.592Z',
        })
        .get('/v2/modules/std/0.162.0')
        .reply(200, {
          version: '0.162.0',
          upload_options: {
            repository: 'denoland/deno_std',
            ref: '0.162.0',
            type: 'github',
          },
          uploaded_at: '2022-10-20T12:10:21.592Z',
        })
        .get('/v2/modules/std/0.161.0')
        .reply(200, { foo: 'bar' });

      const result = await deno.getReleases({
        packageName: 'https://deno.land/std',
        registryUrl: deno.defaultRegistryUrls[0],
      });
      expect(result).toMatchObject({
        releases: [
          {
            version: '0.163.0',
            sourceUrl: 'https://github.com/denoland/deno_std',
            releaseTimestamp: '2022-11-08T21:10:21.592Z',
          },
          {
            version: '0.162.0',
            sourceUrl: 'https://github.com/denoland/deno_std',
            releaseTimestamp: '2022-10-20T12:10:21.592Z',
          },
          {
            version: '0.161.0',
          },
        ],
        tags: {
          popularity: 'top_5_percent',
        },
      });

      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(ZodError),
        }),
        `Deno: failed to get version details for 0.161.0`,
      );
    });

    it('throws error if module endpoint fails', async () => {
      httpMock
        .scope(deno.defaultRegistryUrls[0])
        .get('/v2/modules/std')
        .reply(404);

      await expect(
        deno.getReleases({
          packageName: 'https://deno.land/std',
          registryUrl: deno.defaultRegistryUrls[0],
        }),
      ).rejects.toThrow();
    });

    it('throws error if version endpoint fails', async () => {
      httpMock
        .scope(deno.defaultRegistryUrls[0])
        .get('/v2/modules/std')
        .reply(200, {
          versions: ['0.163.0', '0.162.0'],
          tags: [{ value: 'top_5_percent', kind: 'popularity' }],
        })
        .get('/v2/modules/std/0.163.0')
        .reply(200, {
          version: '0.163.0',
          upload_options: {
            repository: 'denoland/deno_std',
            ref: '0.163.0',
            type: 'github',
          },
          uploaded_at: '2022-11-08T21:10:21.592Z',
        })
        .get('/v2/modules/std/0.162.0')
        .reply(503);
      await expect(
        deno.getReleases({
          packageName: 'https://deno.land/std',
          registryUrl: deno.defaultRegistryUrls[0],
        }),
      ).rejects.toThrow();
    });

    it('returns null if we could not match a deno land dependency', async () => {
      expect(
        await deno.getReleases({
          packageName: 'https://myexample.com/std',
        }),
      ).toBeNull();
    });

    it('returns releases of third-party library', async () => {
      httpMock
        .scope(deno.defaultRegistryUrls[0])
        .get('/v2/modules/postgres')
        .reply(200, {
          versions: ['v0.16.0', 'v0.16.1'],
          tags: [],
        })
        .get('/v2/modules/postgres/v0.16.0')
        .reply(200, {
          version: 'v0.16.0',
          upload_options: {
            repository: 'denodrivers/postgres',
            ref: 'v0.16.0',
            type: 'gitlab',
          },
          uploaded_at: '2022-06-01T20:29:52.413Z',
        })
        .get('/v2/modules/postgres/v0.16.1')
        .reply(200, {
          version: 'v0.16.1',
          upload_options: {
            repository: 'denoland/deno_std',
            ref: 'v0.16.1',
            type: 'gitlab',
          },
          uploaded_at: '2022-06-07T22:43:44.098Z',
        });

      const result = await deno.getReleases({
        packageName: 'https://deno.land/x/postgres',
        registryUrl: deno.defaultRegistryUrls[0],
      });
      expect(result).toMatchObject({
        releases: [
          {
            version: 'v0.16.0',
            releaseTimestamp: '2022-06-01T20:29:52.413Z',
          },
          {
            version: 'v0.16.1',
            releaseTimestamp: '2022-06-07T22:43:44.098Z',
          },
        ],
      });
    });

    it('returns releases of a alternative registry server', async () => {
      httpMock
        .scope('https://api.example.com')
        .get('/v2/modules/postgres')
        .reply(200, {
          versions: ['v0.16.0', 'v0.16.1'],
          tags: [],
        })
        .get('/v2/modules/postgres/v0.16.0')
        .reply(200, {
          version: 'v0.16.0',
          upload_options: {
            repository: 'denodrivers/postgres',
            ref: 'v0.16.0',
            type: 'gitlab',
          },
          uploaded_at: '2022-06-01T20:29:52.413Z',
        })
        .get('/v2/modules/postgres/v0.16.1')
        .reply(200, {
          version: 'v0.16.1',
          upload_options: {
            repository: 'denoland/deno_std',
            ref: 'v0.16.1',
            type: 'gitlab',
          },
          uploaded_at: '2022-06-07T22:43:44.098Z',
        });

      const result = await deno.getReleases({
        packageName: 'https://deno.land/x/postgres',
        registryUrl: 'https://api.example.com',
      });
      expect(result).toMatchObject({
        releases: [
          {
            version: 'v0.16.0',
            releaseTimestamp: '2022-06-01T20:29:52.413Z',
          },
          {
            version: 'v0.16.1',
            releaseTimestamp: '2022-06-07T22:43:44.098Z',
          },
        ],
      });
    });
  });
});
