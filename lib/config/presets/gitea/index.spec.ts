import { hostRules } from '~test/host-rules.ts';
import * as httpMock from '~test/http-mock.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { setBaseUrl } from '../../../util/http/gitea.ts';
import { toBase64 } from '../../../util/string.ts';
import {
  PRESET_INVALID,
  PRESET_INVALID_JSON,
  PRESET_NOT_FOUND,
} from '../util.ts';
import * as gitea from './index.ts';

const giteaApiHost = gitea.Endpoint;
const basePath = '/api/v1/repos/some/repo/contents';

describe('config/presets/gitea/index', () => {
  beforeEach(() => {
    hostRules.add({ token: 'abc' });
    setBaseUrl(giteaApiHost);
  });

  describe('fetchJSONFile()', () => {
    it('returns JSON', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/some-filename.json`)
        .reply(200, {
          type: 'file',
          name: 'some-filename.json',
          path: 'some-filename.json',
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
          type: 'file',
          name: 'some-filename.json5',
          path: 'some-filename.json5',
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

    it('returns JSONC', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/some-filename.jsonc`)
        .reply(200, {
          type: 'file',
          name: 'some-filename.jsonc',
          path: 'some-filename.jsonc',
          content: toBase64('{"from": /* secret! */ "api"}'),
        });

      const res = await gitea.fetchJSONFile(
        'some/repo',
        'some-filename.jsonc',
        giteaApiHost,
        null,
      );
      expect(res).toEqual({ from: 'api' });
    });

    it('throws external host error', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/some-filename.json`)
        .reply(404, {});

      hostRules.add({ abortOnError: true });

      await expect(
        gitea.fetchJSONFile(
          'some/repo',
          'some-filename.json',
          giteaApiHost,
          null,
        ),
      ).rejects.toThrow(ExternalHostError);
    });

    it('throws for non-file response', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/some-filename.json`)
        .reply(200, {
          type: 'dir',
          name: 'some-filename.json',
          path: 'some-filename.json',
        });

      await expect(
        gitea.fetchJSONFile(
          'some/repo',
          'some-filename.json',
          giteaApiHost,
          null,
        ),
      ).rejects.toThrow(PRESET_INVALID);
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

      await expect(gitea.getPreset({ repo: 'some/repo' })).rejects.toThrow(
        'dep not found',
      );
    });

    it('throws if invalid content', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/default.json`)
        .reply(200, {
          type: 'file',
          name: 'default.json',
          path: 'default.json',
          content: toBase64('invalid'),
        });

      await expect(gitea.getPreset({ repo: 'some/repo' })).rejects.toThrow(
        PRESET_INVALID_JSON,
      );
    });

    it('throws if fails to parse', async () => {
      httpMock
        .scope(giteaApiHost)
        .get(`${basePath}/default.json`)
        .reply(200, {
          type: 'file',
          name: 'default.json',
          path: 'default.json',
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
          type: 'file',
          name: 'default.json',
          path: 'default.json',
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
          type: 'file',
          name: 'somefile.json',
          path: 'somefile.json',
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
          type: 'file',
          name: 'somefile.json',
          path: 'somefile.json',
          content: toBase64('{"somename":{"somesubname":{"foo":"bar"}}}'),
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
          type: 'file',
          name: 'custom.json',
          path: 'custom.json',
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
          type: 'file',
          name: 'custom.json',
          path: 'path/custom.json',
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
          type: 'file',
          name: 'somefile.json',
          path: 'somefile.json',
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
          type: 'file',
          name: 'default.json',
          path: 'default.json',
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
          type: 'file',
          name: 'default.json',
          path: 'default.json',
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
          type: 'file',
          name: 'default.json',
          path: 'default.json',
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
          type: 'file',
          name: 'default.json',
          path: 'default.json',
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
