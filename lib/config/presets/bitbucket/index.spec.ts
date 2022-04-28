import * as httpMock from '../../../../test/http-mock';
import { setPlatformApi } from '../../../modules/platform';
import { PRESET_DEP_NOT_FOUND, PRESET_INVALID_JSON } from '../util';
import * as bitbucket from '.';

jest.unmock('../../../modules/platform');

const baseUrl = 'https://api.bitbucket.org';
const basePath = '/2.0/repositories/some/repo/src/HEAD';

describe('config/presets/bitbucket/index', () => {
  beforeAll(() => {
    setPlatformApi('bitbucket');
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
    });

    it('throws on error', async () => {
      httpMock.scope(baseUrl).get(`${basePath}/some-filename.json`).reply(404);
      await expect(
        bitbucket.fetchJSONFile('some/repo', 'some-filename.json')
      ).rejects.toThrow(PRESET_DEP_NOT_FOUND);
    });

    it('throws on invalid json', async () => {
      httpMock
        .scope(baseUrl)
        .get(`${basePath}/some-filename.json`)
        .reply(200, '!@#');
      await expect(
        bitbucket.fetchJSONFile('some/repo', 'some-filename.json')
      ).rejects.toThrow(PRESET_INVALID_JSON);
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
