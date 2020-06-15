import fs from 'fs';
import * as httpMock from '../../../test/httpMock';
import { getReleases } from '.';

const body: any = JSON.parse(
  fs.readFileSync(
    'lib/datasource/dart/__fixtures__/shared_preferences.json',
    'utf8'
  )
);

const baseUrl = 'https://pub.dartlang.org/api/packages/';

describe('datasource/dart', () => {
  beforeEach(() => {
    httpMock.setup();
  });

  afterEach(() => {
    httpMock.reset();
  });

  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock.scope(baseUrl).get('/non_sense').reply(200, null);
      expect(await getReleases({ lookupName: 'non_sense' })).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for empty fields', async () => {
      const withoutVersions = {
        ...body,
        versions: undefined,
      };
      httpMock
        .scope(baseUrl)
        .get('/shared_preferences')
        .reply(200, withoutVersions);
      expect(
        await getReleases({ lookupName: 'shared_preferences' })
      ).toBeNull();

      const withoutLatest = {
        ...body,
        latest: undefined,
      };
      httpMock
        .scope(baseUrl)
        .get('/shared_preferences')
        .reply(200, withoutLatest);
      expect(
        await getReleases({ lookupName: 'shared_preferences' })
      ).toBeNull();

      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/shared_preferences').reply(404);
      expect(
        await getReleases({ lookupName: 'shared_preferences' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get('/shared_preferences').reply(502);
      let e;
      try {
        await getReleases({ lookupName: 'shared_preferences' });
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      httpMock.scope(baseUrl).get('/shared_preferences').replyWithError('');
      expect(
        await getReleases({ lookupName: 'shared_preferences' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data', async () => {
      httpMock.scope(baseUrl).get('/shared_preferences').reply(200, body);
      const res = await getReleases({
        lookupName: 'shared_preferences',
      });
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
