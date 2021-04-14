import fs from 'fs';
import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import * as _hostRules from '../../util/host-rules';
import { id as datasource } from '.';

const hostRules: any = _hostRules;

let res1 = fs.readFileSync(
  'lib/datasource/hex/__fixtures__/certifi.json',
  'utf8'
);
res1 = JSON.parse(res1);

jest.mock('../../util/host-rules');

const baseUrl = 'https://hex.pm/api/packages/';

describe(getName(__filename), () => {
  beforeEach(() => {
    hostRules.hosts.mockReturnValue([]);
    hostRules.find.mockReturnValue({});
    httpMock.setup();
  });

  afterEach(() => {
    jest.resetAllMocks();
    httpMock.reset();
  });

  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock.scope(baseUrl).get('/non_existent_package').reply(200, null);
      expect(
        await getPkgReleases({
          datasource,
          depName: 'non_existent_package',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for missing fields', async () => {
      httpMock.scope(baseUrl).get('/non_existent_package').reply(200, {});
      expect(
        await getPkgReleases({
          datasource,
          depName: 'non_existent_package',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/some_package').reply(404);
      expect(
        await getPkgReleases({ datasource, depName: 'some_package' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 401', async () => {
      httpMock.scope(baseUrl).get('/some_package').reply(401);
      expect(
        await getPkgReleases({ datasource, depName: 'some_package' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for 429', async () => {
      httpMock.scope(baseUrl).get('/some_crate').reply(429);
      await expect(
        getPkgReleases({ datasource, depName: 'some_crate' })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get('/some_crate').reply(502);
      await expect(
        getPkgReleases({ datasource, depName: 'some_crate' })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      httpMock.scope(baseUrl).get('/some_package').replyWithError('');
      expect(
        await getPkgReleases({ datasource, depName: 'some_package' })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null with wrong auth token', async () => {
      httpMock.scope(baseUrl).get('/certifi').reply(401);
      hostRules.find.mockReturnValueOnce({ token: 'this_simple_token' });
      const res = await getPkgReleases({
        datasource,
        depName: 'certifi',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data', async () => {
      httpMock.scope(baseUrl).get('/certifi').reply(200, res1);
      const res = await getPkgReleases({
        datasource,
        depName: 'certifi',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('process public repo without auth', async () => {
      httpMock.scope(baseUrl).get('/certifi').reply(200, res1);
      hostRules.find.mockReturnValueOnce({});
      const res = await getPkgReleases({
        datasource,
        depName: 'certifi',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
