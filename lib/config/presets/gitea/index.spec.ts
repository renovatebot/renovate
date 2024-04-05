import { mockDeep } from 'jest-mock-extended';
import * as httpMock from '../../../../test/http-mock';
import { mocked } from '../../../../test/util';
import * as _hostRules from '../../../util/host-rules';
import { setBaseUrl } from '../../../util/http/gitea';
import { toBase64 } from '../../../util/string';
import { PRESET_INVALID_JSON, PRESET_NOT_FOUND } from '../util';
import * as gitea from '.';

jest.mock('../../../util/host-rules', () => mockDeep());

const hostRules = mocked(_hostRules);

const giteaApiHost = gitea.Endpoint;
const basePath = '/api/v1/repos/some/repo/contents';

describe('config/presets/gitea/index', () => {
  beforeEach(() => {
    hostRules.find.mockReturnValue({ token: 'abc' });
    setBaseUrl(giteaApiHost);
  });

  describe('fetchJSONFile()', () => {
    it('returns JSON', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/some-filename.json`)
        .reply(200, {
          content: toBase64('{"from":"api"}'),
        });

      const res = await gitea.fetchJSONFile(
        'some/repo',
        'some-filename.json',
        giteaApiHost,
        null,
      );
      expect(res).toEqual({ from: 'api' });
    });

    it('returns JSON5', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/some-filename.json5`)
        .reply(200, {
          content: toBase64('{from:"api"}'),
        });

      const res = await gitea.fetchJSONFile(
        'some/repo',
        'some-filename.json5',
        giteaApiHost,
        null,
      );
      expect(res).toEqual({ from: 'api' });
    });
  });

  describe('getPreset()', () => {
    it('tries default then renovate', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/default.json`)
        .reply(404, {})
        .get(`${basePath}/renovate.json`)
        .reply(200, {});

      await expect(gitea.getPreset({ repo: 'some/repo' })).rejects.toThrow();
    });

    it('throws if invalid content', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/default.json`)
        .reply(200, { content: toBase64('invalid') });

      await expect(gitea.getPreset({ repo: 'some/repo' })).rejects.toThrow(
        PRESET_INVALID_JSON,
      );
    });

    it('throws if fails to parse', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: toBase64('not json'),
        });

      await expect(gitea.getPreset({ repo: 'some/repo' })).rejects.toThrow(
        PRESET_INVALID_JSON,
      );
    });

    it('should return default.json', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: toBase64('{"foo":"bar"}'),
        });

      const content = await gitea.getPreset({ repo: 'some/repo' });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should query preset within the file', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/somefile.json`)
        .reply(200, {
          content: toBase64('{"somename":{"foo":"bar"}}'),
        });
      const content = await gitea.getPreset({
        repo: 'some/repo',
        presetName: 'somefile/somename',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should query subpreset', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/somefile.json`)
        .reply(200, {
          content: Buffer.from(
            '{"somename":{"somesubname":{"foo":"bar"}}}',
          ).toString('base64'),
        });

      const content = await gitea.getPreset({
        repo: 'some/repo',
        presetName: 'somefile/somename/somesubname',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should return custom.json', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/custom.json`)
        .reply(200, {
          content: toBase64('{"foo":"bar"}'),
        });
      const content = await gitea.getPreset({
        repo: 'some/repo',
        presetName: 'custom',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should query custom paths', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/path%2Fcustom.json`)
        .reply(200, {
          content: toBase64('{"foo":"bar"}'),
        });
      const content = await gitea.getPreset({
        repo: 'some/repo',
        presetName: 'custom',
        presetPath: 'path',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should throws not-found', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/somefile.json`)
        .reply(200, {
          content: toBase64('{}'),
        });
      await expect(
        gitea.getPreset({
          repo: 'some/repo',
          presetName: 'somefile/somename/somesubname',
        }),
      ).rejects.toThrow(PRESET_NOT_FOUND);
    });
  });

  describe('getPresetFromEndpoint()', () => {
    it('uses default endpoint', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: toBase64('{"from":"api"}'),
        });
      expect(
        await gitea.getPresetFromEndpoint('some/repo', 'default', undefined),
      ).toEqual({ from: 'api' });
    });

    it('uses custom endpoint', async () => {
      httpMock
        .scope('https://api.gitea.example.org')
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: toBase64('{"from":"api"}'),
        });
      expect(
        await gitea
          .getPresetFromEndpoint(
            'some/repo',
            'default',
            undefined,
            'https://api.gitea.example.org',
          )
          .catch(() => ({ from: 'api' })),
      ).toEqual({ from: 'api' });
    });

    it('uses default endpoint with a tag', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/default.json?ref=someTag`)
        .reply(200, {
          content: toBase64('{"from":"api"}'),
        });
      expect(
        await gitea.getPresetFromEndpoint(
          'some/repo',
          'default',
          undefined,
          giteaApiHost,
          'someTag',
        ),
      ).toEqual({ from: 'api' });
    });

    it('uses custom endpoint with a tag', async () => {
      httpMock
        .scope('https://api.gitea.example.org')
        .get(`${basePath}/default.json?ref=someTag`)
        .reply(200, {
          content: toBase64('{"from":"api"}'),
        });
      expect(
        await gitea
          .getPresetFromEndpoint(
            'some/repo',
            'default',
            undefined,
            'https://api.gitea.example.org',
            'someTag',
          )
          .catch(() => ({ from: 'api' })),
      ).toEqual({ from: 'api' });
    });
  });
});
