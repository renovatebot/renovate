import * as httpMock from '../../../../test/http-mock';
import { setPlatformApi } from '../../../modules/platform';
import { setBaseUrl } from '../../../util/http/gerrit';
import { PRESET_DEP_NOT_FOUND, PRESET_INVALID_JSON } from '../util';
import * as gerrit from '.';

jest.unmock('../../../modules/platform');

const gerritEndpointUrl = 'https://dev.gerrit.com/renovate/';
setBaseUrl(gerritEndpointUrl);

describe('config/presets/gerrit/index', () => {
  beforeAll(() => {
    setPlatformApi('gerrit');
  });

  describe('fetchJSONFile()', () => {
    it('returns JSON', async () => {
      const data = { foo: 'bar' };
      httpMock
        .scope(gerritEndpointUrl)
        .get(
          '/a/projects/some%2Frepo/branches/HEAD/files/some-filename.json/content'
        )
        .reply(200, gerritFileResponse(JSON.stringify(data)));

      const res = await gerrit.fetchJSONFile(
        'some/repo',
        'some-filename.json',
        gerritEndpointUrl
      );
      expect(res).toEqual(data);
    });

    it('throws on not found error', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get(
          '/a/projects/some%2Frepo/branches/HEAD/files/some-filename.json/content'
        )
        .reply(404);
      await expect(
        gerrit.fetchJSONFile(
          'some/repo',
          'some-filename.json',
          gerritEndpointUrl
        )
      ).rejects.toThrow(PRESET_DEP_NOT_FOUND);
    });

    it('throws on invalid json', async () => {
      httpMock
        .scope(gerritEndpointUrl)
        .get(
          '/a/projects/some%2Frepo/branches/HEAD/files/some-filename.json/content'
        )
        .reply(200, gerritFileResponse('!@#'));
      await expect(
        gerrit.fetchJSONFile(
          'some/repo',
          'some-filename.json',
          gerritEndpointUrl
        )
      ).rejects.toThrow(PRESET_INVALID_JSON);
    });
  });

  describe('getPresetFromEndpoint()', () => {
    it('uses custom path', async () => {
      const data = { foo: 'bar' };
      httpMock
        .scope(gerritEndpointUrl)
        .get(
          `/a/projects/some%2Frepo/branches/HEAD/files/${encodeURIComponent(
            'foo/bar/some-filename.json'
          )}/content`
        )
        .reply(200, gerritFileResponse(JSON.stringify(data)));

      const res = await gerrit.getPresetFromEndpoint(
        'some/repo',
        'some-filename',
        'foo/bar',
        gerritEndpointUrl
      );
      expect(res).toEqual(data);
    });

    it('uses custom path with tag', async () => {
      const data = { foo: 'bar' };
      httpMock
        .scope(gerritEndpointUrl)
        .get(
          `/a/projects/some%2Frepo/branches/RENOVATE/files/${encodeURIComponent(
            'foo/bar/some-filename.json'
          )}/content`
        )
        .reply(200, gerritFileResponse(JSON.stringify(data)));

      const res = await gerrit.getPresetFromEndpoint(
        'some/repo',
        'some-filename',
        'foo/bar',
        gerritEndpointUrl,
        'RENOVATE'
      );
      expect(res).toEqual(data);
    });
  });
});

function gerritFileResponse(body: string): any {
  return Buffer.from(body).toString('base64');
}
