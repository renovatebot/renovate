import { codeBlock } from 'common-tags';
import type { Upgrade } from '../types.ts';
import { updateDependency } from './update.ts';

describe('modules/manager/nix/update', () => {
  describe('updateDependency', () => {
    it('returns null when depName is missing', () => {
      const res = updateDependency({
        fileContent: 'inputs = {};',
        packageFile: 'flake.nix',
        upgrade: {} as Upgrade,
      });
      expect(res).toBeNull();
    });

    it('returns null when the dependency URL cannot be found', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            other.url = "github:foo/bar";
          };
        }
      `;
      const res = updateDependency({
        fileContent,
        packageFile: 'flake.nix',
        upgrade: { depName: 'testinput' } as Upgrade,
      });
      expect(res).toBeNull();
    });

    it('qualifies a bare ref as refs/tags/ when gitRefType is "tags"', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            testinput.url = "git+ssh://git@git.example.com/example/example?ref=some-branch&rev=oldcommithasholdcommithasholdcommit0000";
          };
        }
      `;
      const upgrade = {
        depName: 'testinput',
        currentValue: 'some-branch',
        currentDigest: 'oldcommithasholdcommithasholdcommit0000',
        newValue: 'v20.0.0',
        newDigest: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        gitRefType: 'tags',
      } as Upgrade;
      const res = updateDependency({
        fileContent,
        packageFile: 'flake.nix',
        upgrade,
      });
      expect(res).toContain('ref=refs/tags/v20.0.0');
      expect(res).toContain('rev=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      expect(res).not.toContain('refs/heads/v20.0.0');
    });

    it('qualifies a bare ref as refs/heads/ when gitRefType is "heads"', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            testinput.url = "git+ssh://git@git.example.com/example/example?ref=v1.0&rev=oldcommithasholdcommithasholdcommit0000";
          };
        }
      `;
      const upgrade = {
        depName: 'testinput',
        currentValue: 'v1.0',
        currentDigest: 'oldcommithasholdcommithasholdcommit0000',
        newValue: 'v1.1',
        newDigest: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        gitRefType: 'heads',
      } as Upgrade;
      const res = updateDependency({
        fileContent,
        packageFile: 'flake.nix',
        upgrade,
      });
      expect(res).toContain('ref=refs/heads/v1.1');
    });

    it('corrects a stale refs/tags/ qualifier to refs/heads/ when the new value is branch-only', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            testinput.url = "git+ssh://git@git.example.com/example/example?ref=refs/tags/1.1&rev=oldcommithasholdcommithasholdcommit0000";
          };
        }
      `;
      const upgrade = {
        depName: 'testinput',
        currentValue: '1.1',
        currentDigest: 'oldcommithasholdcommithasholdcommit0000',
        newValue: '8.10',
        newDigest: 'cccccccccccccccccccccccccccccccccccccccc',
        gitRefType: 'heads',
      } as Upgrade;
      const res = updateDependency({
        fileContent,
        packageFile: 'flake.nix',
        upgrade,
      });
      expect(res).toContain('ref=refs/heads/8.10');
    });

    it('preserves an already-qualified refs/tags/ ref across a tag-to-tag update', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            testinput.url = "git+ssh://git@git.example.com/example/example?ref=refs/tags/v1.0.0&rev=oldcommithasholdcommithasholdcommit0000";
          };
        }
      `;
      const upgrade = {
        depName: 'testinput',
        currentValue: 'v1.0.0',
        currentDigest: 'oldcommithasholdcommithasholdcommit0000',
        newValue: 'v2.0.0',
        newDigest: 'dddddddddddddddddddddddddddddddddddddddd',
        gitRefType: 'tags',
      } as Upgrade;
      const res = updateDependency({
        fileContent,
        packageFile: 'flake.nix',
        upgrade,
      });
      expect(res).toContain('ref=refs/tags/v2.0.0');
    });

    it('falls back to leaving the ref unqualified when gitRefType is unavailable and the old ref was unqualified', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            testinput.url = "git+ssh://git@git.example.com/example/example?ref=main-22.11&rev=oldcommithasholdcommithasholdcommit0000";
          };
        }
      `;
      const upgrade = {
        depName: 'testinput',
        currentValue: 'main-22.11',
        currentDigest: 'oldcommithasholdcommithasholdcommit0000',
        newValue: 'main-23.05',
        newDigest: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      } as Upgrade;
      const res = updateDependency({
        fileContent,
        packageFile: 'flake.nix',
        upgrade,
      });
      expect(res).toContain('ref=main-23.05');
      expect(res).not.toContain('refs/');
    });

    it('handles github: shorthand URLs by direct string substitution', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            disko.url = "github:nix-community/disko/oldrev1234567890oldrev1234567890oldrev12";
          };
        }
      `;
      const upgrade = {
        depName: 'disko',
        currentDigest: 'oldrev1234567890oldrev1234567890oldrev12',
        newDigest: 'newrev1234567890newrev1234567890newrev12',
      } as Upgrade;
      const res = updateDependency({
        fileContent,
        packageFile: 'flake.nix',
        upgrade,
      });
      expect(res).toContain('newrev1234567890newrev1234567890newrev12');
    });

    it('handles github: shorthand URLs with a ref update whose currentValue is present in the URL', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            disko.url = "github:nix-community/disko/v1.0.0";
          };
        }
      `;
      const upgrade = {
        depName: 'disko',
        currentValue: 'v1.0.0',
        newValue: 'v2.0.0',
      } as Upgrade;
      const res = updateDependency({
        fileContent,
        packageFile: 'flake.nix',
        upgrade,
      });
      expect(res).toContain('github:nix-community/disko/v2.0.0');
    });

    it('returns null when the URL cannot be parsed as a URL', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            testinput.url = "not a valid url";
          };
        }
      `;
      const upgrade = {
        depName: 'testinput',
        currentValue: 'a',
        newValue: 'b',
      } as Upgrade;
      const res = updateDependency({
        fileContent,
        packageFile: 'flake.nix',
        upgrade,
      });
      expect(res).toBeNull();
    });

    it('returns unchanged fileContent for a digest-only update when the URL has no rev param to update', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            testinput.url = "git+ssh://git@git.example.com/example/example?ref=main-22.11";
          };
        }
      `;
      const upgrade = {
        depName: 'testinput',
        currentValue: 'main-22.11',
        newValue: 'main-22.11',
        currentDigest: 'oldcommithasholdcommithasholdcommit0000',
        newDigest: 'ffffffffffffffffffffffffffffffffffffffff',
      } as Upgrade;
      const res = updateDependency({
        fileContent,
        packageFile: 'flake.nix',
        upgrade,
      });
      expect(res).toBe(fileContent);
    });

    it('returns null when nothing changes and it is not a digest-only update', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            testinput.url = "github:foo/bar";
          };
        }
      `;
      const upgrade = {
        depName: 'testinput',
      } as Upgrade;
      const res = updateDependency({
        fileContent,
        packageFile: 'flake.nix',
        upgrade,
      });
      expect(res).toBeNull();
    });
  });
});
