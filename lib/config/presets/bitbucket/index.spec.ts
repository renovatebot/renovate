import * as httpMock from '../../../../test/http-mock';
import { getName } from '../../../../test/util';
import { setPlatformApi } from '../../../platform';
import { PRESET_DEP_NOT_FOUND, PRESET_INVALID_JSON } from '../util';
import * as bitbucket from '.';

jest.unmock('../../../platform');

const baseUrl = 'https://api.bitbucket.org';
const basePath = '/2.0/repositories/some/repo/src/HEAD';

describe(getName(__filename), () => {
  beforeAll(() => {
    setPlatformApi('bitbucket');
  });

  beforeEach(() => {
    httpMock.setup();
  });

  afterEach(() => {
    httpMock.reset();
  });

  describe('fetchJSONFile()', () => {
    it('returns JSON', async () => {
      const data = { foo: 'bar' };
      httpMock
        .scope(baseUrl)
        .get(`${basePath}/some-filename.json`)
        .reply(200, JSON.stringify(data));

      const res = await bitbucket.fetchJSONFile(
        'some/repo',
        'some-filename.json'
      );
      expect(res).toEqual(data);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws on error', async () => {
      httpMock.scope(baseUrl).get(`${basePath}/some-filename.json`).reply(404);
      await expect(
        bitbucket.fetchJSONFile('some/repo', 'some-filename.json')
      ).rejects.toThrow(PRESET_DEP_NOT_FOUND);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws on invalid json', async () => {
      httpMock
        .scope(baseUrl)
        .get(`${basePath}/some-filename.json`)
        .reply(200, '!@#');
      await expect(
        bitbucket.fetchJSONFile('some/repo', 'some-filename.json')
      ).rejects.toThrow(PRESET_INVALID_JSON);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getPresetFromEndpoint()', () => {
    it('uses custom path', async () => {
      const data = { foo: 'bar' };
      httpMock
        .scope(baseUrl)
        .get(`${basePath}/foo/bar/some-filename.json`)
        .reply(200, JSON.stringify(data));
      const res = await bitbucket.getPresetFromEndpoint(
        'some/repo',
        'some-filename',
        'foo/bar',
        baseUrl
      );
      expect(res).toEqual(data);
    });
  });
});
