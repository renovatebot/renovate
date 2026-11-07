import { codeBlock } from 'common-tags';
import { ProtoPluginGitUrlToml } from './schema.ts';

describe('modules/datasource/proto-plugin/schema', () => {
  describe('ProtoPluginGitUrlToml', () => {
    it('reads a format v1 git-url', () => {
      const gitUrl = ProtoPluginGitUrlToml.parse(codeBlock`
        [resolve]
        git-url = "https://github.com/bufbuild/buf"
      `);

      expect(gitUrl).toBe('https://github.com/bufbuild/buf');
    });

    it('reads a format v2 git_url', () => {
      const gitUrl = ProtoPluginGitUrlToml.parse(codeBlock`
        format = "2"

        [resolve]
        git_url = "https://github.com/bufbuild/buf"
      `);

      expect(gitUrl).toBe('https://github.com/bufbuild/buf');
    });

    it('returns null for a plugin that resolves through a manifest', () => {
      const gitUrl = ProtoPluginGitUrlToml.parse(codeBlock`
        [resolve]
        manifest-url = "https://example.com/versions.json"
      `);

      expect(gitUrl).toBeNull();
    });
  });
});
