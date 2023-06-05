import { codeBlock } from 'common-tags';
import * as httpMock from '../../../../test/http-mock';
import { PAGE_NOT_FOUND_ERROR } from '../../../constants/error-messages';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { GetReleasesConfig } from '../types';
import { VersionsDatasource, memCache } from './versions-datasource';

const rubygems = new VersionsDatasource('rubygems');

const fullBody =
  codeBlock`
    created_at: 2021-05-04T00:00:00.000Z
    ---
    foo 1.1.1 11111111111111111111111111111111
    bar 2.2.2 22222222222222222222222222222222
    baz 3.3.3 33333333333333333333333333333333
  ` + '\n';

describe('modules/datasource/rubygems/versions-datasource', () => {
  beforeEach(() => {
    memCache.clear();
    jest.resetAllMocks();
  });

  describe('Full sync', () => {
    it('supports sequential access', async () => {
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .reply(200, fullBody);
      const config: Omit<GetReleasesConfig, 'packageName'> = {
        registryUrl: 'https://rubygems.org',
      };

      const foo = await rubygems.getReleases({ ...config, packageName: 'foo' });
      const bar = await rubygems.getReleases({ ...config, packageName: 'bar' });
      const baz = await rubygems.getReleases({ ...config, packageName: 'baz' });
      const qux = await rubygems.getReleases({ ...config, packageName: 'qux' });

      expect(foo).toEqual({ releases: [{ version: '1.1.1' }] });
      expect(bar).toEqual({ releases: [{ version: '2.2.2' }] });
      expect(baz).toEqual({ releases: [{ version: '3.3.3' }] });
      expect(qux).toBeNull();

      expect(
        memCache.get('rubygems-versions-cache:https://rubygems.org')
      ).toMatchObject({
        contentTail: '33333333333333333333333333333333\n',
      });
    });

    it('supports concurrent access', async () => {
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .reply(200, fullBody);
      const config: Omit<GetReleasesConfig, 'packageName'> = {
        registryUrl: 'https://rubygems.org',
      };

      const [foo, bar, baz] = await Promise.all([
        rubygems.getReleases({ ...config, packageName: 'foo' }),
        rubygems.getReleases({ ...config, packageName: 'bar' }),
        rubygems.getReleases({ ...config, packageName: 'baz' }),
      ]);

      expect(foo).toEqual({ releases: [{ version: '1.1.1' }] });
      expect(bar).toEqual({ releases: [{ version: '2.2.2' }] });
      expect(baz).toEqual({ releases: [{ version: '3.3.3' }] });
    });

    it('handles 404', async () => {
      httpMock.scope('https://rubygems.org').get('/versions').reply(404);

      await expect(
        rubygems.getReleases({
          registryUrl: 'https://rubygems.org',
          packageName: 'foo',
        })
      ).rejects.toThrow(PAGE_NOT_FOUND_ERROR);

      await expect(
        rubygems.getReleases({
          registryUrl: 'https://rubygems.org',
          packageName: 'bar',
        })
      ).rejects.toThrow(PAGE_NOT_FOUND_ERROR);

      expect(memCache.size).toBe(1);
    });

    it('handles unknown error', async () => {
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .replyWithError('Unknown error');

      await expect(
        rubygems.getReleases({
          registryUrl: 'https://rubygems.org',
          packageName: 'foo',
        })
      ).rejects.toThrow('Unknown error');
      expect(memCache.size).toBe(0);
    });
  });

  describe('Delta sync', () => {
    beforeAll(() => {
      jest.useFakeTimers({ advanceTimers: true });
    });

    beforeEach(() => {
      jest.setSystemTime(new Date('2021-05-04T00:00:00.000Z'));
    });

    it('refreshes after 15 minutes', async () => {
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .reply(200, fullBody);

      const res1 = await rubygems.getReleases({
        registryUrl: 'https://rubygems.org',
        packageName: 'foo',
      });
      expect(res1).toEqual({ releases: [{ version: '1.1.1' }] });

      jest.advanceTimersByTime(15 * 60 * 1000);
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .reply(
          206,
          codeBlock`
            33333333333333333333333333333333
            foo -1.1.1,1.2.3 44444444444444444444444444444444
          ` + '\n'
        );

      const res2 = await rubygems.getReleases({
        registryUrl: 'https://rubygems.org',
        packageName: 'foo',
      });
      expect(res2).toEqual({ releases: [{ version: '1.2.3' }] });

      expect(
        memCache.get('rubygems-versions-cache:https://rubygems.org')
      ).toMatchObject({
        contentTail: '44444444444444444444444444444444\n',
      });
    });

    it('handles tail-head mismatch', async () => {
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .reply(200, fullBody);

      const res1 = await rubygems.getReleases({
        registryUrl: 'https://rubygems.org',
        packageName: 'foo',
      });
      expect(res1).toEqual({ releases: [{ version: '1.1.1' }] });

      jest.advanceTimersByTime(15 * 60 * 1000);
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .reply(
          206,
          codeBlock`
            01010101010101010101010101010101
            foo -1.1.1,1.2.3 44444444444444444444444444444444
          ` + '\n'
        )
        .get('/versions')
        .reply(
          200,
          codeBlock`
            created_at: 2021-05-04T00:00:00.000Z
            ---
            foo 1.2.3 11111111111111111111111111111111
            bar 2.2.2 22222222222222222222222222222222
            baz 3.3.3 01010101010101010101010101010101
          ` + '\n'
        );

      const res2 = await rubygems.getReleases({
        registryUrl: 'https://rubygems.org',
        packageName: 'foo',
      });
      expect(res2).toEqual({ releases: [{ version: '1.2.3' }] });

      expect(
        memCache.get('rubygems-versions-cache:https://rubygems.org')
      ).toMatchObject({
        contentTail: '01010101010101010101010101010101\n',
      });
    });

    it('handles full body response', async () => {
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .reply(200, fullBody);

      const res1 = await rubygems.getReleases({
        registryUrl: 'https://rubygems.org',
        packageName: 'foo',
      });
      expect(res1).toEqual({ releases: [{ version: '1.1.1' }] });

      jest.advanceTimersByTime(15 * 60 * 1000);
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .reply(
          200,
          fullBody + `foo -1.1.1,1.2.3 44444444444444444444444444444444\n`
        );

      const res2 = await rubygems.getReleases({
        registryUrl: 'https://rubygems.org',
        packageName: 'foo',
      });
      expect(res2).toEqual({ releases: [{ version: '1.2.3' }] });

      expect(
        memCache.get('rubygems-versions-cache:https://rubygems.org')
      ).toMatchObject({
        contentTail: '44444444444444444444444444444444\n',
      });
    });

    describe('Error handling', () => {
      beforeEach(async () => {
        httpMock
          .scope('https://rubygems.org')
          .get('/versions')
          .reply(200, fullBody);

        await rubygems.getReleases({
          registryUrl: 'https://rubygems.org',
          packageName: 'foo',
        });

        jest.advanceTimersByTime(15 * 60 * 1000);
      });

      it('handles 404', async () => {
        httpMock.scope('https://rubygems.org').get('/versions').reply(404);

        await expect(
          rubygems.getReleases({
            registryUrl: 'https://rubygems.org',
            packageName: 'foo',
          })
        ).rejects.toThrow(PAGE_NOT_FOUND_ERROR);

        await expect(
          rubygems.getReleases({
            registryUrl: 'https://rubygems.org',
            packageName: 'foo',
          })
        ).rejects.toThrow(PAGE_NOT_FOUND_ERROR);
      });

      it('handles 416', async () => {
        httpMock
          .scope('https://rubygems.org')
          .get('/versions')
          .reply(416)
          .get('/versions')
          .reply(
            200,
            codeBlock`
              created_at: 2021-05-05T00:00:00.000Z
              ---
              foo 9.9.9 99999999999999999999999999999999
            ` + '\n'
          );

        const res = await rubygems.getReleases({
          registryUrl: 'https://rubygems.org',
          packageName: 'foo',
        });

        expect(res).toEqual({ releases: [{ version: '9.9.9' }] });
      });

      it('handles unknown errors', async () => {
        httpMock
          .scope('https://rubygems.org')
          .get('/versions')
          .replyWithError('Unknown error');

        await expect(
          rubygems.getReleases({
            registryUrl: 'https://rubygems.org',
            packageName: 'foo',
          })
        ).rejects.toThrow('Unknown error');

        expect(
          memCache.get('rubygems-versions-cache:https://rubygems.org')
        ).toBeUndefined();
      });
    });
  });
});
