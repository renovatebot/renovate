import { ExternalHostError } from '../../../types/errors/external-host-error';
import { setBaseUrl } from '../../../util/http/forgejo';
import { toBase64 } from '../../../util/string';
import { PRESET_INVALID_JSON, PRESET_NOT_FOUND } from '../util';
import * as forgejo from '.';
import { hostRules } from '~test/host-rules';
import * as httpMock from '~test/http-mock';

const forgejoApiHost = forgejo.Endpoint;
const basePath = '/api/v1/repos/some/repo/contents';

describe('config/presets/forgejo/index', () => {
  beforeEach(() => {
    hostRules.add({ token: 'abc' });
    setBaseUrl(forgejoApiHost);
  });

  describe('fetchJSONFile()', () => {
    it('returns JSON', async () => {
      httpMock
        .scope(forgejoApiHost)
        .get(`${basePath}/some-filename.json`)
        .reply(200, {
          content: toBase64('{"from":"api"}'),
        });

      const res = await forgejo.fetchJSONFile(
        'some/repo',
        'some-filename.json',
        forgejoApiHost,
        null,
      );
      expect(res).toEqual({ from: 'api' });
    });

    it('returns JSON5', async () => {
      httpMock
        .scope(forgejoApiHost)
        .get(`${basePath}/some-filename.json5`)
        .reply(200, {
          content: toBase64('{from:"api"}'),
        });

      const res = await forgejo.fetchJSONFile(
        'some/repo',
        'some-filename.json5',
        forgejoApiHost,
        null,
      );
      expect(res).toEqual({ from: 'api' });
    });

    it('throws external host error', async () => {
      httpMock
        .scope(forgejoApiHost)
        .get(`${basePath}/some-filename.json`)
        .reply(404, {});

      hostRules.add({ abortOnError: true });

      await expect(
        forgejo.fetchJSONFile(
          'some/repo',
          'some-filename.json',
          forgejoApiHost,
          null,
        ),
      ).rejects.toThrow(ExternalHostError);
    });
  });

  describe('getPreset()', () => {
    it('tries default then renovate', async () => {
      httpMock
        .scope(forgejoApiHost)
        .get(`${basePath}/default.json`)
        .reply(404, {})
        .get(`${basePath}/renovate.json`)
        .reply(200, {});

      await expect(forgejo.getPreset({ repo: 'some/repo' })).rejects.toThrow();
    });

    it('throws if invalid content', async () => {
      httpMock
        .scope(forgejoApiHost)
        .get(`${basePath}/default.json`)
        .reply(200, { content: toBase64('invalid') });

      await expect(forgejo.getPreset({ repo: 'some/repo' })).rejects.toThrow(
        PRESET_INVALID_JSON,
      );
    });

    it('throws if fails to parse', async () => {
      httpMock
        .scope(forgejoApiHost)
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: toBase64('not json'),
        });

      await expect(forgejo.getPreset({ repo: 'some/repo' })).rejects.toThrow(
        PRESET_INVALID_JSON,
      );
    });

    it('should return default.json', async () => {
      httpMock
        .scope(forgejoApiHost)
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: toBase64('{"foo":"bar"}'),
        });

      const content = await forgejo.getPreset({ repo: 'some/repo' });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should query preset within the file', async () => {
      httpMock
        .scope(forgejoApiHost)
        .get(`${basePath}/somefile.json`)
        .reply(200, {
          content: toBase64('{"somename":{"foo":"bar"}}'),
        });
      const content = await forgejo.getPreset({
        repo: 'some/repo',
        presetName: 'somefile/somename',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should query subpreset', async () => {
      httpMock
        .scope(forgejoApiHost)
        .get(`${basePath}/somefile.json`)
        .reply(200, {
          content: Buffer.from(
            '{"somename":{"somesubname":{"foo":"bar"}}}',
          ).toString('base64'),
        });

      const content = await forgejo.getPreset({
        repo: 'some/repo',
        presetName: 'somefile/somename/somesubname',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should return custom.json', async () => {
      httpMock
        .scope(forgejoApiHost)
        .get(`${basePath}/custom.json`)
        .reply(200, {
          content: toBase64('{"foo":"bar"}'),
        });
      const content = await forgejo.getPreset({
        repo: 'some/repo',
        presetName: 'custom',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should query custom paths', async () => {
      httpMock
        .scope(forgejoApiHost)
        .get(`${basePath}/path%2Fcustom.json`)
        .reply(200, {
          content: toBase64('{"foo":"bar"}'),
        });
      const content = await forgejo.getPreset({
        repo: 'some/repo',
        presetName: 'custom',
        presetPath: 'path',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should throws not-found', async () => {
      httpMock
        .scope(forgejoApiHost)
        .get(`${basePath}/somefile.json`)
        .reply(200, {
          content: toBase64('{}'),
        });
      await expect(
        forgejo.getPreset({
          repo: 'some/repo',
          presetName: 'somefile/somename/somesubname',
        }),
      ).rejects.toThrow(PRESET_NOT_FOUND);
    });
  });

  describe('getPresetFromEndpoint()', () => {
    it('uses default endpoint', async () => {
      httpMock
        .scope(forgejoApiHost)
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: toBase64('{"from":"api"}'),
        });
      expect(
        await forgejo.getPresetFromEndpoint('some/repo', 'default', undefined),
      ).toEqual({ from: 'api' });
    });

    it('uses custom endpoint', async () => {
      httpMock
        .scope('https://api.forgejo.example.org')
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: toBase64('{"from":"api"}'),
        });
      expect(
        await forgejo
          .getPresetFromEndpoint(
            'some/repo',
            'default',
            undefined,
            'https://api.forgejo.example.org',
          )
          .catch(() => ({ from: 'api' })),
      ).toEqual({ from: 'api' });
    });

    it('uses default endpoint with a tag', async () => {
      httpMock
        .scope(forgejoApiHost)
        .get(`${basePath}/default.json?ref=someTag`)
        .reply(200, {
          content: toBase64('{"from":"api"}'),
        });
      expect(
        await forgejo.getPresetFromEndpoint(
          'some/repo',
          'default',
          undefined,
          forgejoApiHost,
          'someTag',
        ),
      ).toEqual({ from: 'api' });
    });

    it('uses custom endpoint with a tag', async () => {
      httpMock
        .scope('https://api.forgejo.example.org')
        .get(`${basePath}/default.json?ref=someTag`)
        .reply(200, {
          content: toBase64('{"from":"api"}'),
        });
      expect(
        await forgejo
          .getPresetFromEndpoint(
            'some/repo',
            'default',
            undefined,
            'https://api.forgejo.example.org',
            'someTag',
          )
          .catch(() => ({ from: 'api' })),
      ).toEqual({ from: 'api' });
    });
  });
});
