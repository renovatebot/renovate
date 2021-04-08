import * as httpMock from '../../../../test/http-mock';
import { getName, mocked } from '../../../../test/util';
import * as _hostRules from '../../../util/host-rules';
import { PRESET_DEP_NOT_FOUND, PRESET_INVALID_JSON } from '../util';
import * as bitbucketServer from '.';

jest.mock('../../../util/host-rules');

const hostRules = mocked(_hostRules);

const bitbucketApiHost = 'https://git.company.org';
const basePath = '/rest/api/1.0/projects/some/repos/repo/browse';

describe(getName(__filename), () => {
  beforeEach(() => {
    httpMock.setup();
    hostRules.find.mockReturnValue({ token: 'abc' });
  });

  afterEach(() => httpMock.reset());

  describe('fetchJSONFile()', () => {
    it('returns JSON', async () => {
      httpMock
        .scope(bitbucketApiHost)
        .get(`${basePath}/some-filename.json`)
        .query({ limit: 20000 })
        .reply(200, {
          isLastPage: true,
          lines: [{ text: '{"from":"api"' }, { text: '}' }],
        });

      const res = await bitbucketServer.fetchJSONFile(
        'some/repo',
        'some-filename.json',
        bitbucketApiHost
      );
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws 404', async () => {
      httpMock
        .scope(bitbucketApiHost)
        .get(`${basePath}/some-filename.json`)
        .query({ limit: 20000 })
        .reply(404);

      await expect(
        bitbucketServer.fetchJSONFile(
          'some/repo',
          'some-filename.json',
          bitbucketApiHost
        )
      ).rejects.toThrow(PRESET_DEP_NOT_FOUND);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws to big', async () => {
      httpMock
        .scope(bitbucketApiHost)
        .get(`${basePath}/some-filename.json`)
        .query({ limit: 20000 })
        .reply(200, {
          isLastPage: false,
          size: 50000,
          lines: [{ text: '{"from":"api"}' }],
        });

      await expect(
        bitbucketServer.fetchJSONFile(
          'some/repo',
          'some-filename.json',
          bitbucketApiHost
        )
      ).rejects.toThrow(PRESET_INVALID_JSON);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws to invalid', async () => {
      httpMock
        .scope(bitbucketApiHost)
        .get(`${basePath}/some-filename.json`)
        .query({ limit: 20000 })
        .reply(200, {
          isLastPage: true,
          lines: [{ text: '{"from":"api"' }],
        });

      await expect(
        bitbucketServer.fetchJSONFile(
          'some/repo',
          'some-filename.json',
          bitbucketApiHost
        )
      ).rejects.toThrow(PRESET_INVALID_JSON);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getPresetFromEndpoint()', () => {
    it('uses custom endpoint', async () => {
      httpMock
        .scope('https://api.github.example.org')
        .get(`${basePath}/default.json`)
        .query({ limit: 20000 })
        .reply(200, {
          isLastPage: true,
          lines: [{ text: '{"from":"api"}' }],
        });
      expect(
        await bitbucketServer.getPresetFromEndpoint(
          'some/repo',
          'default',
          undefined,
          'https://api.github.example.org'
        )
      ).toEqual({ from: 'api' });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('uses custom path', async () => {
      httpMock
        .scope('https://api.github.example.org')
        .get(`${basePath}/path/default.json`)
        .query({ limit: 20000 })
        .reply(200, {
          isLastPage: true,
          lines: [{ text: '{"from":"api"}' }],
        });
      expect(
        await bitbucketServer.getPresetFromEndpoint(
          'some/repo',
          'default',
          'path',
          'https://api.github.example.org'
        )
      ).toEqual({ from: 'api' });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
