import { codeBlock } from 'common-tags';
import {
  type ProtoPlugin,
  ProtoPluginToml,
  resolvePluginConfig,
} from './schema.ts';

describe('modules/datasource/proto-plugin/schema', () => {
  describe('resolvePluginConfig()', () => {
    function parse(content: string): ProtoPlugin {
      const parsed = ProtoPluginToml.safeParse(content);
      if (!parsed.success) {
        throw parsed.error;
      }
      return parsed.data;
    }

    it('derives a github-tags config from git-url', () => {
      const plugin = parse(codeBlock`
        [resolve]
        git-url = "https://github.com/bufbuild/buf"
      `);

      expect(resolvePluginConfig(plugin)).toEqual({
        datasource: 'github-tags',
        packageName: 'bufbuild/buf',
        registryUrl: 'https://github.com',
      });
    });

    it('falls back to the install download-url when git-url is absent', () => {
      const plugin = parse(codeBlock`
        [install]
        download-url = "https://github.com/j178/prek/releases/download/v{version}/{download_file}"
      `);

      expect(resolvePluginConfig(plugin)).toEqual({
        datasource: 'github-tags',
        packageName: 'j178/prek',
        registryUrl: 'https://github.com',
      });
    });

    it('derives a gitlab-tags config for gitlab repos', () => {
      const plugin = parse(codeBlock`
        [resolve]
        git-url = "https://gitlab.com/gitlab-org/cli"
      `);

      expect(resolvePluginConfig(plugin)).toEqual({
        datasource: 'gitlab-tags',
        packageName: 'gitlab-org/cli',
        registryUrl: 'https://gitlab.com',
      });
    });

    it('strips a trailing .git suffix from the resolved repo', () => {
      const plugin = parse(codeBlock`
        [resolve]
        git-url = "https://github.com/bufbuild/buf.git"
      `);

      expect(resolvePluginConfig(plugin)).toEqual({
        datasource: 'github-tags',
        packageName: 'bufbuild/buf',
        registryUrl: 'https://github.com',
      });
    });

    it('returns an unsupported-url skip for non github/gitlab hosts', () => {
      const plugin = parse(codeBlock`
        [resolve]
        git-url = "https://bitbucket.org/foo/bar"
      `);

      expect(resolvePluginConfig(plugin)).toEqual({
        skipReason: 'unsupported-url',
      });
    });

    it('returns an unsupported-datasource skip when no repo url exists', () => {
      const plugin = parse(codeBlock`
        name = "empty"
      `);

      expect(resolvePluginConfig(plugin)).toEqual({
        skipReason: 'unsupported-datasource',
      });
    });
  });
});
