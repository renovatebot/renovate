import { codeBlock } from 'common-tags';
import { updateDependency } from './update';

describe('modules/manager/nix/update', () => {
  describe('updateDependency', () => {
    it('returns null if no depName', () => {
      const fileContent = 'test';
      const result = updateDependency({
        fileContent,
        upgrade: {
          currentValue: '1.0.0',
          newValue: '2.0.0',
        },
      });
      expect(result).toBeNull();
    });

    it('returns null if dependency not found', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            nixpkgs.url = "github:NixOS/nixpkgs";
          };
        }
      `;
      const result = updateDependency({
        fileContent,
        upgrade: {
          depName: 'nonexistent',
          currentValue: '1.0.0',
          newValue: '2.0.0',
        },
      });
      expect(result).toBeNull();
    });

    it('updates ref when only ref is present', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            mypackage.url = "git+ssh://git@example.com/org/repo?ref=refs/tags/1.0.0";
          };
        }
      `;
      const result = updateDependency({
        fileContent,
        upgrade: {
          depName: 'mypackage',
          currentValue: '1.0.0',
          newValue: '2.0.0',
        },
      });
      expect(result).toContain('ref=refs/tags/2.0.0');
      expect(result).not.toContain('ref=refs/tags/1.0.0');
    });

    it('updates rev when only rev is present', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            mypackage.url = "git+ssh://git@example.com/org/repo?rev=abc123";
          };
        }
      `;
      const result = updateDependency({
        fileContent,
        upgrade: {
          depName: 'mypackage',
          currentDigest: 'abc123',
          newDigest: 'def456',
        },
      });
      expect(result).toContain('rev=def456');
      expect(result).not.toContain('rev=abc123');
    });

    it('updates both ref and rev when both are present', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            foo-bar.url = "git+ssh://git@example.com/foo/bar?ref=refs/tags/2.8.0&rev=109baf8a54a0bec9fa07b91d32e960e6ec8b4d84";
          };
        }
      `;
      const result = updateDependency({
        fileContent,
        upgrade: {
          depName: 'foo-bar',
          currentValue: '2.8.0',
          newValue: '2.23.0',
          currentDigest: '109baf8a54a0bec9fa07b91d32e960e6ec8b4d84',
          newDigest: '49d3aba772c263c6343c30452259d7c47a6d76d6',
        },
      });
      expect(result).toContain('ref=refs/tags/2.23.0');
      expect(result).toContain('rev=49d3aba772c263c6343c30452259d7c47a6d76d6');
      expect(result).not.toContain('ref=refs/tags/2.8.0');
      expect(result).not.toContain(
        'rev=109baf8a54a0bec9fa07b91d32e960e6ec8b4d84',
      );
    });

    it('handles refs/heads/ prefix correctly', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            mypackage.url = "git+ssh://git@example.com/org/repo?ref=refs/heads/main&rev=abc123";
          };
        }
      `;
      const result = updateDependency({
        fileContent,
        upgrade: {
          depName: 'mypackage',
          currentValue: 'main',
          newValue: 'develop',
          currentDigest: 'abc123',
          newDigest: 'def456',
        },
      });
      expect(result).toContain('ref=refs/heads/develop');
      expect(result).toContain('rev=def456');
    });

    it('returns null when no changes are needed', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            mypackage.url = "git+ssh://git@example.com/org/repo?ref=refs/tags/1.0.0";
          };
        }
      `;
      const result = updateDependency({
        fileContent,
        upgrade: {
          depName: 'mypackage',
          currentValue: '1.0.0',
          newValue: '1.0.0',
        },
      });
      expect(result).toBeNull();
    });

    it('updates dependencies with attribute set syntax', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            cachix-github-ref-tag = { url = "github:cachix/cachix?ref=refs/tags/v1.7.2"; };
            cachix-githttps-ref-tag = {
              url = "git+https://github.com/cachix/cachix.git?ref=refs/tags/v1.7.2";
            };
          };
        }
      `;
      const result1 = updateDependency({
        fileContent,
        upgrade: {
          depName: 'cachix-github-ref-tag',
          currentValue: 'v1.7.2',
          newValue: 'v1.8.0',
        },
      });
      expect(result1).toContain(
        'cachix-github-ref-tag = { url = "github:cachix/cachix?ref=refs/tags/v1.8.0"',
      );

      const result2 = updateDependency({
        fileContent,
        upgrade: {
          depName: 'cachix-githttps-ref-tag',
          currentValue: 'v1.7.2',
          newValue: 'v1.8.0',
        },
      });
      expect(result2).toContain(
        'url = "git+https://github.com/cachix/cachix.git?ref=refs/tags/v1.8.0"',
      );
    });
  });
});
