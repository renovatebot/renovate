import { codeBlock } from 'common-tags';
import * as httpMock from '../../../../test/http-mock';
import { Http } from '../../../util/http';
import { VersionsEndpointCache, memCache } from './versions-endpoint-cache';

const rubygems = new VersionsEndpointCache(new Http('rubygems'));

const fullBody =
  codeBlock`
    created_at: 2021-05-04T00:00:00.000Z
    ---
    foo 1.1.1 11111111111111111111111111111111
    bar 2.2.2 22222222222222222222222222222222
    baz 3.3.3 33333333333333333333333333333333
  ` + '\n';

const registryUrl = 'https://rubygems.org';

describe('modules/datasource/rubygems/versions-endpoint-cache', () => {
  beforeEach(() => {
    memCache.clear();
  });

  describe('Full sync', () => {
    it('supports sequential access', async () => {
      httpMock.scope(registryUrl).get('/versions').reply(200, fullBody);

      const foo = await rubygems.getVersions(registryUrl, 'foo');
      const bar = await rubygems.getVersions(registryUrl, 'bar');
      const baz = await rubygems.getVersions(registryUrl, 'baz');
      const qux = await rubygems.getVersions(registryUrl, 'qux');

      expect(foo).toEqual({ type: 'success', versions: ['1.1.1'] });
      expect(bar).toEqual({ type: 'success', versions: ['2.2.2'] });
      expect(baz).toEqual({ type: 'success', versions: ['3.3.3'] });
      expect(qux).toEqual({ type: 'not-found' });

      expect(
        memCache.get('rubygems-versions-cache:https://rubygems.org')
      ).toMatchObject({
        contentTail: '33333333333333333333333333333333\n',
      });
    });

    it('supports concurrent access', async () => {
      httpMock.scope(registryUrl).get('/versions').reply(200, fullBody);

      const [foo, bar, baz] = await Promise.all([
        rubygems.getVersions(registryUrl, 'foo'),
        rubygems.getVersions(registryUrl, 'bar'),
        rubygems.getVersions(registryUrl, 'baz'),
      ]);

      expect(foo).toEqual({ type: 'success', versions: ['1.1.1'] });
      expect(bar).toEqual({ type: 'success', versions: ['2.2.2'] });
      expect(baz).toEqual({ type: 'success', versions: ['3.3.3'] });
    });

    it('handles 404', async () => {
      httpMock.scope(registryUrl).get('/versions').reply(404);

      expect(await rubygems.getVersions(registryUrl, 'foo')).toEqual({
        type: 'not-supported',
      });

      expect(await rubygems.getVersions(registryUrl, 'foo')).toEqual({
        type: 'not-supported',
      });

      expect(memCache.size).toBe(1);
    });

    it('handles unknown error', async () => {
      httpMock
        .scope(registryUrl)
        .get('/versions')
        .replyWithError('Unknown error');

      await expect(rubygems.getVersions(registryUrl, 'foo')).rejects.toThrow(
        'Unknown error'
      );
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
      httpMock.scope(registryUrl).get('/versions').reply(200, fullBody);

      const res1 = await rubygems.getVersions(registryUrl, 'foo');
      expect(res1).toEqual({ type: 'success', versions: ['1.1.1'] });

      jest.advanceTimersByTime(15 * 60 * 1000);
      httpMock
        .scope(registryUrl)
        .get('/versions')
        .reply(
          206,
          codeBlock`
            33333333333333333333333333333333
            foo -1.1.1,1.2.3 44444444444444444444444444444444
          ` + '\n'
        );

      const res2 = await rubygems.getVersions(registryUrl, 'foo');
      expect(res2).toEqual({ type: 'success', versions: ['1.2.3'] });

      expect(
        memCache.get('rubygems-versions-cache:https://rubygems.org')
      ).toMatchObject({
        contentTail: '44444444444444444444444444444444\n',
      });
    });

    it('handles tail-head mismatch', async () => {
      httpMock.scope(registryUrl).get('/versions').reply(200, fullBody);

      const res1 = await rubygems.getVersions(registryUrl, 'foo');
      expect(res1).toEqual({ type: 'success', versions: ['1.1.1'] });

      jest.advanceTimersByTime(15 * 60 * 1000);
      httpMock
        .scope(registryUrl)
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

      const res2 = await rubygems.getVersions(registryUrl, 'foo');
      expect(res2).toEqual({ type: 'success', versions: ['1.2.3'] });

      expect(
        memCache.get('rubygems-versions-cache:https://rubygems.org')
      ).toMatchObject({
        contentTail: '01010101010101010101010101010101\n',
      });
    });

    it('handles full body response', async () => {
      httpMock.scope(registryUrl).get('/versions').reply(200, fullBody);

      const res1 = await rubygems.getVersions(registryUrl, 'foo');
      expect(res1).toEqual({ type: 'success', versions: ['1.1.1'] });

      jest.advanceTimersByTime(15 * 60 * 1000);
      httpMock
        .scope(registryUrl)
        .get('/versions')
        .reply(
          200,
          fullBody + `foo -1.1.1,1.2.3 44444444444444444444444444444444\n`
        );

      const res2 = await rubygems.getVersions(registryUrl, 'foo');
      expect(res2).toEqual({ type: 'success', versions: ['1.2.3'] });

      expect(
        memCache.get('rubygems-versions-cache:https://rubygems.org')
      ).toMatchObject({
        contentTail: '44444444444444444444444444444444\n',
      });
    });

    describe('Error handling', () => {
      beforeEach(async () => {
        httpMock.scope(registryUrl).get('/versions').reply(200, fullBody);

        await rubygems.getVersions(registryUrl, 'foo');

        jest.advanceTimersByTime(15 * 60 * 1000);
      });

      it('handles 404', async () => {
        httpMock.scope(registryUrl).get('/versions').reply(404);

        expect(await rubygems.getVersions(registryUrl, 'foo')).toEqual({
          type: 'not-supported',
        });

        expect(await rubygems.getVersions(registryUrl, 'foo')).toEqual({
          type: 'not-supported',
        });
      });

      it('handles 416', async () => {
        httpMock
          .scope(registryUrl)
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

        const res = await rubygems.getVersions(registryUrl, 'foo');

        expect(res).toEqual({ type: 'success', versions: ['9.9.9'] });
      });

      it('handles unknown errors', async () => {
        httpMock
          .scope(registryUrl)
          .get('/versions')
          .replyWithError('Unknown error');

        await expect(rubygems.getVersions(registryUrl, 'foo')).rejects.toThrow(
          'Unknown error'
        );

        expect(
          memCache.get('rubygems-versions-cache:https://rubygems.org')
        ).toBeUndefined();
      });
    });
  });

  describe('Non-rubygems registry', () => {
    it('tries /info/:package', async () => {
      httpMock
        .scope('https://example.com')
        .get('/info/foo')
        .reply(
          200,
          codeBlock`
            ---
            1.1.1 |checksum:aaa
            2.2.2 |checksum:bbb
            3.3.3 |checksum:ccc

          `
        );

      const res = await rubygems.getVersions('https://example.com', 'foo');

      expect(res).toEqual({
        type: 'success',
        versions: ['1.1.1', '2.2.2', '3.3.3'],
      });
    });

    it('handles errors', async () => {
      httpMock
        .scope('https://example.com')
        .get('/info/foo')
        .replyWithError('Unknown error');
      const res = await rubygems.getVersions('https://example.com', 'foo');
      expect(res).toEqual({ type: 'not-supported' });
    });
  });
});
