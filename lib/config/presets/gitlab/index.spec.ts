import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { toBase64 } from '../../../util/string.ts';
import { PRESET_DEP_NOT_FOUND } from '../util.ts';
import * as gitlab from './index.ts';

const gitlabApiHost = 'https://gitlab.com';
const projectPath = '/api/v4/projects/some%2Frepo';
const basePath = `${projectPath}/repository`;

function fileBody(content: unknown): { content: string } {
  return { content: toBase64(JSON.stringify(content)) };
}

describe('config/presets/gitlab/index', () => {
  describe('getPreset()', () => {
    it('throws EXTERNAL_HOST_ERROR', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(`${basePath}/files/non-default.json?ref=HEAD`)
        .reply(500);
      await expect(
        gitlab.getPreset({
          repo: 'some/repo',
          presetName: 'non-default',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws if missing', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(`${basePath}/files/default.json?ref=HEAD`)
        .reply(404)
        .get(`${basePath}/files/renovate.json?ref=HEAD`)
        .reply(404);
      await expect(gitlab.getPreset({ repo: 'some/repo' })).rejects.toThrow(
        PRESET_DEP_NOT_FOUND,
      );
    });

    it('should return the preset', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(`${basePath}/files/default.json?ref=HEAD`)
        .reply(200, fileBody({ foo: 'bar' }));

      const content = await gitlab.getPreset({ repo: 'some/repo' });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should return the preset with a tag', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(`${basePath}/files/default.json?ref=someTag`)
        .reply(200, fileBody({ foo: 'bar' }));

      const content = await gitlab.getPreset({
        repo: 'some/repo',
        tag: 'someTag',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should query custom paths', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(`${basePath}/files/path%2Fcustom.json?ref=HEAD`)
        .reply(200, fileBody({ foo: 'bar' }));

      const content = await gitlab.getPreset({
        repo: 'some/repo',
        presetPath: 'path',
        presetName: 'custom',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should query custom paths with .json extension', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(`${basePath}/files/path%2Fcustom.json?ref=HEAD`)
        .reply(200, fileBody({ foo: 'bar' }));

      const content = await gitlab.getPreset({
        repo: 'some/repo',
        presetPath: 'path',
        presetName: 'custom.json',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should query custom paths with .json5 extension', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(`${basePath}/files/path%2Fcustom.json5?ref=HEAD`)
        .reply(200, fileBody({ foo: 'bar' }));

      const content = await gitlab.getPreset({
        repo: 'some/repo',
        presetPath: 'path',
        presetName: 'custom.json5',
      });
      expect(content).toEqual({ foo: 'bar' });
    });
  });

  describe('getPresetFromEndpoint()', () => {
    it('uses default endpoint', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(`${basePath}/files/some.json?ref=HEAD`)
        .reply(200, fileBody({ preset: { file: {} } }));
      await expect(
        gitlab.getPresetFromEndpoint(
          'some/repo',
          'some/preset/file',
          undefined,
        ),
      ).resolves.toEqual({});
    });

    it('uses custom endpoint', async () => {
      httpMock
        .scope('https://gitlab.example.org')
        .get(`${basePath}/files/some.json?ref=HEAD`)
        .reply(404);
      await expect(
        gitlab.getPresetFromEndpoint(
          'some/repo',
          'some/preset/file',
          undefined,
          'https://gitlab.example.org/api/v4',
        ),
      ).rejects.toThrow(PRESET_DEP_NOT_FOUND);
    });

    it('uses default endpoint with a tag', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(`${basePath}/files/some.json?ref=someTag`)
        .reply(200, fileBody({ preset: { file: {} } }));
      await expect(
        gitlab.getPresetFromEndpoint(
          'some/repo',
          'some/preset/file',
          undefined,
          'https://gitlab.com/api/v4',
          'someTag',
        ),
      ).resolves.toEqual({});
    });

    it('uses custom endpoint with a tag', async () => {
      httpMock
        .scope('https://gitlab.example.org')
        .get(`${basePath}/files/some.json?ref=someTag`)
        .reply(200, fileBody({ preset: { file: {} } }));
      await expect(
        gitlab.getPresetFromEndpoint(
          'some/repo',
          'some/preset/file',
          undefined,
          'https://gitlab.example.org/api/v4',
          'someTag',
        ),
      ).resolves.toEqual({});
    });
  });
});
