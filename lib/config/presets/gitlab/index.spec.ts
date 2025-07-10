import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { PRESET_DEP_NOT_FOUND } from '../util';
import * as gitlab from '.';
import * as httpMock from '~test/http-mock';

const gitlabApiHost = 'https://gitlab.com';
const projectPath = '/api/v4/projects/some%2Frepo';
const basePath = `${projectPath}/repository`;

describe('config/presets/gitlab/index', () => {
  describe('fetchJSONFile()', () => {
    it('should parse JSON5 file with simple filename', async () => {
      const content = '{\n  // comment\n  "foo": "bar"\n}';
      httpMock
        .scope(gitlabApiHost)
        .get(projectPath)
        .reply(200, {
          default_branch: 'main',
        })
        .get(`${basePath}/files/config.json5/raw?ref=main`)
        .reply(200, content);

      const result = await gitlab.fetchJSONFile(
        'some/repo',
        'config.json5',
        'https://gitlab.com/api/v4/',
      );
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should parse JSON5 file with path', async () => {
      const content = '{\n  // comment\n  "foo": "bar"\n}';
      httpMock
        .scope(gitlabApiHost)
        .get(projectPath)
        .reply(200, {
          default_branch: 'main',
        })
        .get(`${basePath}/files/src%2Frenovate%2Fconfig.json5/raw?ref=main`)
        .reply(200, content);

      const result = await gitlab.fetchJSONFile(
        'some/repo',
        'src/renovate/config.json5',
        'https://gitlab.com/api/v4/',
      );
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should parse JSON5 file with URL-encoded path', async () => {
      const content = '{\n  // comment\n  "foo": "bar"\n}';
      httpMock
        .scope(gitlabApiHost)
        .get(projectPath)
        .reply(200, {
          default_branch: 'main',
        })
        .get(`${basePath}/files/src%252Frenovate%252Fconfig.json5/raw?ref=main`)
        .reply(200, content);

      const result = await gitlab.fetchJSONFile(
        'some/repo',
        'src%2Frenovate%2Fconfig.json5',
        'https://gitlab.com/api/v4/',
      );
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should parse JSON5 file with complex URL-encoded path', async () => {
      const content = '{\n  // comment\n  "foo": "bar"\n}';
      httpMock
        .scope('https://gitlab.example.com')
        .get('/api/v4/projects/some%2Frepo')
        .reply(200, {
          default_branch: 'main',
        })
        .get(
          `/api/v4/projects/some%2Frepo/repository/files/configs%252Fsrc%252Frenovate%252Fconfig%252Ejson5/raw?ref=main`,
        )
        .reply(200, content);

      const result = await gitlab.fetchJSONFile(
        'some/repo',
        'configs%2Fsrc%2Frenovate%2Fconfig%2Ejson5',
        'https://gitlab.example.com/api/v4/',
      );
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should parse regular JSON file correctly', async () => {
      const content = '{"foo": "bar"}';
      httpMock
        .scope(gitlabApiHost)
        .get(projectPath)
        .reply(200, {
          default_branch: 'main',
        })
        .get(`${basePath}/files/config.json/raw?ref=main`)
        .reply(200, content);

      const result = await gitlab.fetchJSONFile(
        'some/repo',
        'config.json',
        'https://gitlab.com/api/v4/',
      );
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should handle JSONC files with path extraction', async () => {
      const content = '{\n  // comment\n  "foo": "bar"\n}';
      httpMock
        .scope(gitlabApiHost)
        .get(projectPath)
        .reply(200, {
          default_branch: 'main',
        })
        .get(`${basePath}/files/src%2Fconfig.jsonc/raw?ref=main`)
        .reply(200, content);

      const result = await gitlab.fetchJSONFile(
        'some/repo',
        'src/config.jsonc',
        'https://gitlab.com/api/v4/',
      );
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should throw error when file not found', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(projectPath)
        .reply(200, {
          default_branch: 'main',
        })
        .get(`${basePath}/files/nonexistent.json5/raw?ref=main`)
        .reply(404);

      await expect(
        gitlab.fetchJSONFile(
          'some/repo',
          'nonexistent.json5',
          'https://gitlab.com/api/v4/',
        ),
      ).rejects.toThrow(PRESET_DEP_NOT_FOUND);
    });

    it('should correctly extract .json5 extension from nested path for parsing', async () => {
      // Test that JSON5 content is parsed correctly when filename has .json5 extension
      // even when buried in a nested path
      const json5Content =
        '{\n  // This is a JSON5 comment\n  "extends": ["config:base"],\n  "timezone": "America/New_York"\n}';
      httpMock
        .scope(gitlabApiHost)
        .get(projectPath)
        .reply(200, {
          default_branch: 'main',
        })
        .get(
          `${basePath}/files/deep%2Fnested%2Fpath%2Fto%2Frenovate.json5/raw?ref=main`,
        )
        .reply(200, json5Content);

      const result = await gitlab.fetchJSONFile(
        'some/repo',
        'deep/nested/path/to/renovate.json5',
        'https://gitlab.com/api/v4/',
      );
      expect(result).toEqual({
        extends: ['config:base'],
        timezone: 'America/New_York',
      });
    });

    it('should correctly extract .json extension from nested path for parsing', async () => {
      // Test that regular JSON content is parsed correctly when filename has .json extension
      const jsonContent =
        '{"extends": ["config:base"], "timezone": "America/New_York"}';
      httpMock
        .scope(gitlabApiHost)
        .get(projectPath)
        .reply(200, {
          default_branch: 'main',
        })
        .get(
          `${basePath}/files/deep%2Fnested%2Fpath%2Fto%2Frenovate.json/raw?ref=main`,
        )
        .reply(200, jsonContent);

      const result = await gitlab.fetchJSONFile(
        'some/repo',
        'deep/nested/path/to/renovate.json',
        'https://gitlab.com/api/v4/',
      );
      expect(result).toEqual({
        extends: ['config:base'],
        timezone: 'America/New_York',
      });
    });

    it('should handle deeply URL-encoded paths with .json5 extension', async () => {
      // Test that complex URL-encoded paths with .json5 extension are handled correctly
      const json5Content =
        '{\n  // Complex configuration\n  "extends": ["config:base"]\n}';
      httpMock
        .scope(gitlabApiHost)
        .get(projectPath)
        .reply(200, {
          default_branch: 'main',
        })
        .get(
          `${basePath}/files/src%252Fconfigs%252Frenovate%252Fdefault.json5/raw?ref=main`,
        )
        .reply(200, json5Content);

      const result = await gitlab.fetchJSONFile(
        'some/repo',
        'src%2Fconfigs%2Frenovate%2Fdefault.json5',
        'https://gitlab.com/api/v4/',
      );
      expect(result).toEqual({
        extends: ['config:base'],
      });
    });

    it('should handle self-hosted GitLab Repository files API scenario', async () => {
      // Test the specific scenario mentioned: self-hosted GitLab instances using Repository files API
      // with URLs like: https://gitlab.example.com/api/v4/projects/13083/repository/files/src%2Frenovate%2Fconfig%2Ejson5?ref=main
      const json5Content =
        '{\n  // Self-hosted GitLab config\n  "extends": ["config:base"],\n  "enabled": true\n}';
      httpMock
        .scope('https://gitlab.example.com')
        .get('/api/v4/projects/myorg%2Fmyrepo')
        .reply(200, {
          default_branch: 'main',
        })
        .get(
          '/api/v4/projects/myorg%2Fmyrepo/repository/files/src%252Frenovate%252Fconfig%252Ejson5/raw?ref=main',
        )
        .reply(200, json5Content);

      const result = await gitlab.fetchJSONFile(
        'myorg/myrepo',
        'src%2Frenovate%2Fconfig%2Ejson5',
        'https://gitlab.example.com/api/v4/',
      );
      expect(result).toEqual({
        extends: ['config:base'],
        enabled: true,
      });
    });
  });

  describe('extractFilenameFromGitLabPath()', () => {
    it('should extract filename from simple filename', () => {
      const result = gitlab.extractFilenameFromGitLabPath('config.json5');
      expect(result).toBe('config.json5');
    });

    it('should extract filename from path', () => {
      const result = gitlab.extractFilenameFromGitLabPath(
        'src/renovate/config.json5',
      );
      expect(result).toBe('src/renovate/config.json5');
    });

    it('should extract filename from URL-encoded path', () => {
      const result = gitlab.extractFilenameFromGitLabPath(
        'src%2Frenovate%2Fconfig.json5',
      );
      expect(result).toBe('src%2Frenovate%2Fconfig.json5');
    });

    it('should extract filename from GitLab API URL', () => {
      const result = gitlab.extractFilenameFromGitLabPath(
        'https://gitlab.example.com/api/v4/projects/13083/repository/files/config.json5?ref=main',
      );
      expect(result).toBe('config.json5');
    });

    it('should handle GitLab API URL with /raw suffix', () => {
      const result = gitlab.extractFilenameFromGitLabPath(
        'https://gitlab.example.com/api/v4/projects/13083/repository/files/config.json5/raw?ref=main',
      );
      expect(result).toBe('config.json5');
    });

    it('should handle GitLab API URL with nested path and /raw suffix', () => {
      const result = gitlab.extractFilenameFromGitLabPath(
        'https://gitlab.example.com/api/v4/projects/13083/repository/files/src/renovate/config.json5/raw?ref=main',
      );
      expect(result).toBe('config.json5');
    });

    it('should handle non-URL string and return as is', () => {
      const result = gitlab.extractFilenameFromGitLabPath(
        'just-a-filename.json',
      );
      expect(result).toBe('just-a-filename.json');
    });

    it('should handle URL with empty pathname', () => {
      const result = gitlab.extractFilenameFromGitLabPath(
        'https://gitlab.example.com',
      );
      expect(result).toBe('');
    });

    it('should handle URL with pathname that is just "/raw"', () => {
      const result = gitlab.extractFilenameFromGitLabPath(
        'https://gitlab.example.com/raw',
      );
      expect(result).toBe('');
    });

    it('should handle URL with pathname that becomes empty after removing /raw', () => {
      const result = gitlab.extractFilenameFromGitLabPath(
        'https://gitlab.example.com/raw?ref=main',
      );
      expect(result).toBe('');
    });

    it('should handle URL with root-level path', () => {
      const result = gitlab.extractFilenameFromGitLabPath(
        'https://gitlab.example.com/config.json5',
      );
      expect(result).toBe('config.json5');
    });
  });

  describe('getPreset()', () => {
    it('throws EXTERNAL_HOST_ERROR', async () => {
      httpMock.scope(gitlabApiHost).get(projectPath).reply(500);
      await expect(
        gitlab.getPreset({
          repo: 'some/repo',
          presetName: 'non-default',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws if project could not be found', async () => {
      httpMock.scope(gitlabApiHost).get(projectPath).reply(404);
      await expect(
        gitlab.getPreset({
          repo: 'some/repo',
          presetName: 'non-default',
        }),
      ).rejects.toThrow(PRESET_DEP_NOT_FOUND);
    });

    it('throws if missing', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(projectPath)
        .twice()
        .reply(200, {})
        .get(`${basePath}/files/default.json/raw?ref=master`)
        .reply(404)
        .get(`${basePath}/files/renovate.json/raw?ref=master`)
        .reply(404);
      await expect(gitlab.getPreset({ repo: 'some/repo' })).rejects.toThrow(
        PRESET_DEP_NOT_FOUND,
      );
    });

    it('should return the preset', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(projectPath)
        .reply(200, {
          default_branch: 'main',
        })
        .get(`${basePath}/files/default.json/raw?ref=main`)
        .reply(200, { foo: 'bar' }, {});

      const content = await gitlab.getPreset({ repo: 'some/repo' });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should return the preset with a tag', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(`${basePath}/files/default.json/raw?ref=someTag`)
        .reply(200, { foo: 'bar' }, {});

      const content = await gitlab.getPreset({
        repo: 'some/repo',
        tag: 'someTag',
      });
      expect(content).toEqual({ foo: 'bar' });
    });

    it('should query custom paths', async () => {
      httpMock
        .scope(gitlabApiHost)
        .get(projectPath)
        .reply(200, {
          default_branch: 'master',
        })
        .get(`${basePath}/files/path%2Fcustom.json/raw?ref=master`)
        .reply(200, { foo: 'bar' }, {});

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
        .get(projectPath)
        .reply(200, {
          default_branch: 'master',
        })
        .get(`${basePath}/files/path%2Fcustom.json/raw?ref=master`)
        .reply(200, { foo: 'bar' }, {});

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
        .get(projectPath)
        .reply(200, {
          default_branch: 'master',
        })
        .get(`${basePath}/files/path%2Fcustom.json5/raw?ref=master`)
        .reply(200, { foo: 'bar' }, {});

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
        .get(projectPath)
        .reply(200, {
          default_branch: 'devel',
        })
        .get(`${basePath}/files/some.json/raw?ref=devel`)
        .reply(200, { preset: { file: {} } });
      expect(
        await gitlab.getPresetFromEndpoint(
          'some/repo',
          'some/preset/file',
          undefined,
        ),
      ).toEqual({});
    });

    it('uses custom endpoint', async () => {
      httpMock
        .scope('https://gitlab.example.org')
        .get(projectPath)
        .reply(200, {
          default_branch: 'devel',
        })
        .get(`${basePath}/files/some.json/raw?ref=devel`)
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
        .get(`${basePath}/files/some.json/raw?ref=someTag`)
        .reply(200, { preset: { file: {} } });
      expect(
        await gitlab.getPresetFromEndpoint(
          'some/repo',
          'some/preset/file',
          undefined,
          'https://gitlab.com/api/v4',
          'someTag',
        ),
      ).toEqual({});
    });

    it('uses custom endpoint with a tag', async () => {
      httpMock
        .scope('https://gitlab.example.org')
        .get(`${basePath}/files/some.json/raw?ref=someTag`)
        .reply(200, { preset: { file: {} } });
      expect(
        await gitlab.getPresetFromEndpoint(
          'some/repo',
          'some/preset/file',
          undefined,
          'https://gitlab.example.org/api/v4',
          'someTag',
        ),
      ).toEqual({});
    });
  });
});
