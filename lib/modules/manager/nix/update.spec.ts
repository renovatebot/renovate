import { codeBlock } from 'common-tags';
import { updateDependency } from './update';
import { logger } from '~test/util';

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
      expect(logger.logger.debug).toHaveBeenCalledWith('No depName provided');
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
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Could not find URL for dependency nonexistent',
      );
    });

    it('returns null if dependency has invalid URL', () => {
      const fileContent = codeBlock`
        {
          inputs = {
            nixpkgs.url = "derp";
          };
        }
      `;
      const result = updateDependency({
        fileContent,
        upgrade: {
          depName: 'nixpkgs',
        },
      });
      expect(result).toBeNull();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Could not parse URL for dependency nixpkgs: derp',
      );
    });

    describe('GitHub sources', () => {
      it('updates branch', () => {
        const fileContent = codeBlock`
          {
            inputs = {
              nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
            };
          }
        `;
        const result = updateDependency({
          fileContent,
          upgrade: {
            depName: 'nixpkgs',
            currentValue: '24.05',
            newValue: '25.05',
          },
        });
        expect(result).toContain('nixos-25.05');
        expect(result).not.toContain('nixos-24.05');
      });

      it('updates commit', () => {
        const fileContent = codeBlock`
          {
            inputs = {
              nixpkgs.url = "github:NixOS/nixpkgs/af51545ec9a44eadf3fe3547610a5cdd882bc34e";
            };
          }
        `;
        const result = updateDependency({
          fileContent,
          upgrade: {
            depName: 'nixpkgs',
            currentDigest: 'af51545ec9a44eadf3fe3547610a5cdd882bc34e',
            newDigest: '11cb3517b3af6af300dd6c055aeda73c9bf52c48',
          },
        });
        expect(result).toContain('11cb3517b3af6af300dd6c055aeda73c9bf52c48');
        expect(result).not.toContain(
          'af51545ec9a44eadf3fe3547610a5cdd882bc34e',
        );
      });

      it('updates branch ref', () => {
        const fileContent = codeBlock`
          {
            inputs = {
              nixpkgs.url = "github:NixOS/nixpkgs?ref=refs/heads/nixos-24.05";
            };
          }
        `;
        const result = updateDependency({
          fileContent,
          upgrade: {
            depName: 'nixpkgs',
            currentValue: '24.05',
            newValue: '25.05',
          },
        });
        expect(result).toContain('ref=refs/heads/nixos-25.05');
        expect(result).not.toContain('ref=refs/heads/nixos-24.05');
      });

      it('updates tag ref', () => {
        const fileContent = codeBlock`
          {
            inputs = {
              nixpkgs.url = "github:NixOS/nixpkgs?ref=refs/tags/24.05";
            };
          }
        `;
        const result = updateDependency({
          fileContent,
          upgrade: {
            depName: 'nixpkgs',
            currentValue: '24.05',
            newValue: '25.05',
          },
        });
        expect(result).toContain('ref=refs/tags/25.05');
        expect(result).not.toContain('ref=refs/tags/24.05');
      });

      it('updates rev', () => {
        const fileContent = codeBlock`
          {
            inputs = {
              nixpkgs.url = "github:NixOS/nixpkgs?rev=af51545ec9a44eadf3fe3547610a5cdd882bc34e";
            };
          }
        `;
        const result = updateDependency({
          fileContent,
          upgrade: {
            depName: 'nixpkgs',
            currentDigest: 'af51545ec9a44eadf3fe3547610a5cdd882bc34e',
            newDigest: '11cb3517b3af6af300dd6c055aeda73c9bf52c48',
          },
        });
        expect(result).toContain(
          'rev=11cb3517b3af6af300dd6c055aeda73c9bf52c48',
        );
        expect(result).not.toContain(
          'rev=af51545ec9a44eadf3fe3547610a5cdd882bc34e',
        );
      });
    });

    describe('Git sources', () => {
      it.skip('updates branch ref with refs/heads/ prefix', () => {
        const fileContent = codeBlock`
          {
            inputs = {
              mypackage.url = "git+ssh://git@example.com/org/repo?ref=refs/heads/release-1.0";
            };
          }
        `;
        const result = updateDependency({
          fileContent,
          upgrade: {
            depName: 'mypackage',
            currentValue: '1.0',
            newValue: '2.0',
          },
        });
        expect(result).toContain('ref=refs/heads/release-2.0');
        expect(result).not.toContain('ref=refs/heads/release-1.0');
      });

      it.skip('updates branch ref without refs/heads/ prefix', () => {
        const fileContent = codeBlock`
          {
            inputs = {
              mypackage.url = "git+ssh://git@example.com/org/repo?ref=release-1.0";
            };
          }
        `;
        const result = updateDependency({
          fileContent,
          upgrade: {
            depName: 'mypackage',
            currentValue: '1.0',
            newValue: '2.0',
          },
        });
        expect(result).toContain('ref=release-2.0');
        expect(result).not.toContain('ref=release-1.0');
      });

      it('updates tag ref', () => {
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

      it('updates rev', () => {
        const fileContent = codeBlock`
          {
            inputs = {
              mypackage.url = "git+ssh://git@example.com/org/repo?rev=0da084a03fa90c38c859208c38fae6bbfd7b9144";
            };
          }
        `;
        const result = updateDependency({
          fileContent,
          upgrade: {
            depName: 'mypackage',
            currentDigest: '0da084a03fa90c38c859208c38fae6bbfd7b9144',
            newDigest: '7b6b5d6a5ac69143671c30570f9fa5eaa6318e89',
          },
        });
        expect(result).toContain(
          'rev=7b6b5d6a5ac69143671c30570f9fa5eaa6318e89',
        );
        expect(result).not.toContain(
          'rev=0da084a03fa90c38c859208c38fae6bbfd7b9144',
        );
      });

      it('updates ref and rev', () => {
        const fileContent = codeBlock`
          {
            inputs = {
              foo-bar.url = "git+ssh://git@example.com/foo/bar?ref=refs/tags/2.8.0&rev=73d65dcf7d7af76346b084c775e4df9697372a45";
            };
          }
        `;
        const result = updateDependency({
          fileContent,
          upgrade: {
            depName: 'foo-bar',
            currentValue: '2.8.0',
            newValue: '2.23.0',
            currentDigest: '73d65dcf7d7af76346b084c775e4df9697372a45',
            newDigest: '2d503a1f6dd58a771f0ee3ded286f2f11c49a6f2',
          },
        });
        expect(result).toContain('ref=refs/tags/2.23.0');
        expect(result).toContain(
          'rev=2d503a1f6dd58a771f0ee3ded286f2f11c49a6f2',
        );
        expect(result).not.toContain('ref=refs/tags/2.8.0');
        expect(result).not.toContain(
          'rev=73d65dcf7d7af76346b084c775e4df9697372a45',
        );
      });
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
      expect(logger.logger.trace).toHaveBeenCalledWith(
        {
          depName: 'mypackage',
          url: 'git+ssh://git@example.com/org/repo?ref=refs/tags/1.0.0',
        },
        'No changes made to URL',
      );
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
