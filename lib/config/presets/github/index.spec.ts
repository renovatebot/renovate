import { mockDeep } from 'jest-mock-extended';
import * as httpMock from '../../../../test/http-mock';
import { mocked } from '../../../../test/util';
import * as _hostRules from '../../../util/host-rules';
import { toBase64 } from '../../../util/string';
import { PRESET_INVALID_JSON, PRESET_NOT_FOUND } from '../util';
import * as github from '.';

jest.mock('../../../util/host-rules', () => mockDeep());

const hostRules = mocked(_hostRules);

const githubApiHost = github.Endpoint;
const basePath = '/repos/some/repo/contents';

describe('config/presets/github/index', () => {
  beforeEach(() => {
    hostRules.find.mockReturnValue({ token: 'abc' });
  });

  describe('fetchJSONFile()', () => {
    it('returns JSON', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`${basePath}/some-filename.json`)
        .reply(200, {
          content: toBase64('{"from":"api"}'),
        });

      const res = await github.fetchJSONFile(
        'some/repo',
        'some-filename.json',
        githubApiHost,
        undefined,
      );
      expect(res).toEqual({ from: 'api' });
    });
  });

  describe('getPreset()', () => {
    it('tries default then renovate', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`${basePath}/default.json`)
        .reply(404, {})
        .get(`${basePath}/renovate.json`)
        .reply(200, {});

      await expect(github.getPreset({ repo: 'some/repo' })).rejects.toThrow();
    });

    it('throws if invalid content', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`${basePath}/default.json`)
        .reply(200, { content: toBase64('invalid') });

      await expect(github.getPreset({ repo: 'some/repo' })).rejects.toThrow(
        PRESET_INVALID_JSON,
      );
    });

    it('throws if fails to parse', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: toBase64('not json'),
        });

      await expect(github.getPreset({ repo: 'some/repo' })).rejects.toThrow(
        PRESET_INVALID_JSON,
      );
    });

    it('should return default.json', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: toBase64('{"foo":"bar"}'),
        });

      const content = await github.getPreset({ repo: 'some/repo' });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should query preset within the file', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`${basePath}/somefile.json`)
        .reply(200, {
          content: toBase64('{"somename":{"foo":"bar"}}'),
        });
      const content = await github.getPreset({
        repo: 'some/repo',
        presetName: 'somefile/somename',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should query preset within the file when .json extension provided', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`${basePath}/somefile.json`)
        .reply(200, {
          content: toBase64('{"foo":"bar"}'),
        });
      const content = await github.getPreset({
        repo: 'some/repo',
        presetName: 'somefile.json',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should query preset within the file when .json5 extension provided', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`${basePath}/somefile.json5`)
        .reply(200, {
          content: toBase64('{foo:"bar"}'),
        });
      const content = await github.getPreset({
        repo: 'some/repo',
        presetName: 'somefile.json5',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should query subpreset', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`${basePath}/somefile.json`)
        .reply(200, {
          content: Buffer.from(
            '{"somename":{"somesubname":{"foo":"bar"}}}',
          ).toString('base64'),
        });

      const content = await github.getPreset({
        repo: 'some/repo',
        presetName: 'somefile/somename/somesubname',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should return custom.json', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`${basePath}/custom.json`)
        .reply(200, {
          content: toBase64('{"foo":"bar"}'),
        });
      const content = await github.getPreset({
        repo: 'some/repo',
        presetName: 'custom',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should query custom paths', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`${basePath}/path/custom.json`)
        .reply(200, {
          content: toBase64('{"foo":"bar"}'),
        });
      const content = await github.getPreset({
        repo: 'some/repo',
        presetName: 'custom',
        presetPath: 'path',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should throws not-found', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`${basePath}/somefile.json`)
        .reply(200, {
          content: toBase64('{}'),
        });
      await expect(
        github.getPreset({
          repo: 'some/repo',
          presetName: 'somefile/somename/somesubname',
        }),
      ).rejects.toThrow(PRESET_NOT_FOUND);
    });
  });

  describe('getPresetFromEndpoint()', () => {
    it('uses default endpoint', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: toBase64('{"from":"api"}'),
        });
      expect(
        await github.getPresetFromEndpoint('some/repo', 'default', undefined),
      ).toEqual({ from: 'api' });
    });

    it('uses custom endpoint', async () => {
      httpMock
        .scope('https://api.github.example.org')
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: toBase64('{"from":"api"}'),
        });
      expect(
        await github
          .getPresetFromEndpoint(
            'some/repo',
            'default',
            undefined,
            'https://api.github.example.org',
            undefined,
          )
          .catch(() => ({ from: 'api' })),
      ).toEqual({ from: 'api' });
    });

    it('uses default endpoint with a tag', async () => {
      httpMock
        .scope(githubApiHost)
        .get(`${basePath}/default.json?ref=someTag`)
        .reply(200, {
          content: toBase64('{"from":"api"}'),
        });
      expect(
        await github.getPresetFromEndpoint(
          'some/repo',
          'default',
          undefined,
          githubApiHost,
          'someTag',
        ),
      ).toEqual({ from: 'api' });
    });

    it('uses custom endpoint with a tag', async () => {
      httpMock
        .scope('https://api.github.example.org')
        .get(`${basePath}/default.json?ref=someTag`)
        .reply(200, {
          content: toBase64('{"from":"api"}'),
        });
      expect(
        await github
          .getPresetFromEndpoint(
            'some/repo',
            'default',
            undefined,
            'https://api.github.example.org',
            'someTag',
          )
          .catch(() => ({ from: 'api' })),
      ).toEqual({ from: 'api' });
    });
  });
});
