import { codeBlock } from 'common-tags';
import { fs, git } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import { coerceArray } from '../../../util/array.ts';
import { getUpdatedPackageFiles } from '../../../workers/repository/update/branch/get-updated.ts';
import { flattenUpdates } from '../../../workers/repository/updates/flatten.ts';
import type { BranchConfig } from '../../../workers/types.ts';
import type { LookupUpdate } from '../types.ts';
import * as nix from './index.ts';

vi.mock('../../../util/fs/index.ts');
vi.mock('../../../util/git/semantic.ts');

async function getUpgrades(
  updates: Record<string, LookupUpdate[]>,
  nixpkgsOriginal: { ref?: string; rev?: string } = { ref: 'nixos-26.05' },
) {
  const flakeLock = {
    nodes: {
      root: {
        inputs: { nixpkgs: 'nixpkgs', 'otterwiki-source': 'otterwiki-source' },
      },
      nixpkgs: {
        locked: {
          type: 'github',
          rev: 'b3fe9581c9061c749abef42b6d4ee7b7c05c33fa',
        },
        original: {
          type: 'github',
          owner: 'NixOS',
          repo: 'nixpkgs',
          ...nixpkgsOriginal,
        },
      },
      'otterwiki-source': {
        locked: {
          type: 'github',
          rev: '623903665d38d7f1c2ef11df007e0e7f313e4cfc',
        },
        original: {
          type: 'github',
          owner: 'redimp',
          repo: 'otterwiki',
          ref: 'v2.24.1',
        },
      },
    },
    root: 'root',
    version: 7,
  };
  fs.readLocalFile.mockResolvedValueOnce(JSON.stringify(flakeLock));
  const extracted = await nix.extractPackageFile('', 'flake.nix');
  const deps = extracted!.deps.map((dep) => ({
    ...dep,
    updates: coerceArray(updates[dep.depName!]),
  }));
  const config = { ...getConfig(), nix: { enabled: true } };
  return flattenUpdates(config, {
    nix: [{ packageFile: 'flake.nix', deps }],
  });
}

describe('modules/manager/nix/integration', () => {
  let config: BranchConfig;

  beforeEach(() => {
    config = {
      baseBranch: 'base-branch',
      manager: 'nix',
      branchName: 'renovate/nixpkgs-digest',
      upgrades: [],
    };
    fs.getSiblingFileName.mockImplementation(
      (fileName, siblingName) => siblingName,
    );
  });

  it.each`
    reuseExistingBranch
    ${false}
    ${true}
  `(
    'regenerates flake.lock for a digest update with reuseExistingBranch=$reuseExistingBranch',
    async ({ reuseExistingBranch }) => {
      const fileContent = codeBlock`
        {
          inputs = {
            nixpkgs.url = "github:NixOS/nixpkgs?ref=nixos-26.05";
          };
          outputs = _: { };
        }
      `;
      git.getFile.mockResolvedValue(fileContent);
      const updateArtifacts = vi
        .spyOn(nix, 'updateArtifacts')
        .mockResolvedValueOnce([
          {
            file: {
              type: 'addition',
              path: 'flake.lock',
              contents: 'updated lock',
            },
          },
        ]);
      config.reuseExistingBranch = reuseExistingBranch;
      config.upgrades = await getUpgrades({
        nixpkgs: [
          {
            updateType: 'digest',
            newValue: 'nixos-26.05',
            newDigest: 'f3a73bcf5d1c5b75a66cf35a48957e30d41d647a',
          },
        ],
      });

      const result = await getUpdatedPackageFiles(config);

      expect(config.upgrades[0].isLockfileUpdate).toBeTrue();
      expect(updateArtifacts).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          packageFileName: 'flake.nix',
          newPackageFileContent: fileContent,
          updatedDeps: config.upgrades,
        }),
      );
      expect(result.updatedArtifacts).toEqual([
        { type: 'addition', path: 'flake.lock', contents: 'updated lock' },
      ]);
      expect(result.artifactErrors).toEqual([]);
    },
  );

  it('regenerates flake.lock for an input tracking the default branch', async () => {
    const fileContent = codeBlock`
      {
        inputs.nixpkgs.url = "github:NixOS/nixpkgs";
      }
    `;
    git.getFile.mockResolvedValue(fileContent);
    const updateArtifacts = vi
      .spyOn(nix, 'updateArtifacts')
      .mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'flake.lock',
            contents: 'updated lock',
          },
        },
      ]);
    config.upgrades = await getUpgrades(
      {
        nixpkgs: [
          {
            updateType: 'digest',
            newDigest: 'f3a73bcf5d1c5b75a66cf35a48957e30d41d647a',
          },
        ],
      },
      {},
    );

    const result = await getUpdatedPackageFiles(config);

    expect(config.upgrades[0].isLockfileUpdate).toBeTrue();
    expect(updateArtifacts).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ newPackageFileContent: fileContent }),
    );
    expect(result.updatedArtifacts).toEqual([
      { type: 'addition', path: 'flake.lock', contents: 'updated lock' },
    ]);
  });

  it('rewrites a digest explicitly pinned in flake.nix', async () => {
    const fileContent = codeBlock`
      {
        inputs.nixpkgs.url = "github:NixOS/nixpkgs?ref=nixos-26.05&rev=b3fe9581c9061c749abef42b6d4ee7b7c05c33fa";
      }
    `;
    git.getFile.mockResolvedValue(fileContent);
    vi.spyOn(nix, 'updateArtifacts').mockResolvedValueOnce(null);
    config.upgrades = await getUpgrades(
      {
        nixpkgs: [
          {
            updateType: 'digest',
            newValue: 'nixos-26.05',
            newDigest: 'f3a73bcf5d1c5b75a66cf35a48957e30d41d647a',
          },
        ],
      },
      {
        ref: 'nixos-26.05',
        rev: 'b3fe9581c9061c749abef42b6d4ee7b7c05c33fa',
      },
    );

    const result = await getUpdatedPackageFiles(config);

    expect(config.upgrades[0].isLockfileUpdate).toBeUndefined();
    expect(result.updatedPackageFiles).toEqual([
      {
        type: 'addition',
        path: 'flake.nix',
        contents: fileContent.replace(
          'b3fe9581c9061c749abef42b6d4ee7b7c05c33fa',
          'f3a73bcf5d1c5b75a66cf35a48957e30d41d647a',
        ),
      },
    ]);
  });

  it('does not regenerate artifacts for an unsupported version declaration', async () => {
    const fileContent = codeBlock`
      {
        inputs = {
          otterwiki-source = {
            flake = false;
            url = "github:redimp/otterwiki?ref=v2.24.1";
          };
        };
      }
    `;
    git.getFile.mockResolvedValue(fileContent);
    const updateArtifacts = vi.spyOn(nix, 'updateArtifacts');
    config.upgrades = await getUpgrades({
      'otterwiki-source': [
        {
          updateType: 'minor',
          newValue: 'v2.26.0',
          newVersion: 'v2.26.0',
        },
      ],
    });

    const result = await getUpdatedPackageFiles(config);

    expect(config.upgrades[0].isLockfileUpdate).toBeUndefined();
    expect(updateArtifacts).not.toHaveBeenCalled();
    expect(result.updatedPackageFiles).toEqual([]);
    expect(result.updatedArtifacts).toEqual([]);
  });

  it('keeps an earlier version update when a digest update follows it', async () => {
    const fileContent = codeBlock`
      {
        inputs = {
          otterwiki-source.url = "github:redimp/otterwiki?ref=v2.24.1";
          nixpkgs.url = "github:NixOS/nixpkgs?ref=nixos-26.05";
        };
      }
    `;
    git.getFile.mockResolvedValue(fileContent);
    const updateArtifacts = vi
      .spyOn(nix, 'updateArtifacts')
      .mockResolvedValueOnce([
        {
          file: {
            type: 'addition',
            path: 'flake.lock',
            contents: 'updated lock',
          },
        },
      ]);
    const upgrades = await getUpgrades({
      'otterwiki-source': [
        {
          updateType: 'minor',
          newValue: 'v2.26.0',
          newVersion: 'v2.26.0',
        },
      ],
      nixpkgs: [
        {
          updateType: 'digest',
          newValue: 'nixos-26.05',
          newDigest: 'f3a73bcf5d1c5b75a66cf35a48957e30d41d647a',
        },
      ],
    });
    config.upgrades = [upgrades[1], upgrades[0]];

    const result = await getUpdatedPackageFiles(config);

    expect(updateArtifacts).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        newPackageFileContent: fileContent.replace('v2.24.1', 'v2.26.0'),
        updatedDeps: config.upgrades,
      }),
    );
    expect(result.updatedPackageFiles).toEqual([
      {
        type: 'addition',
        path: 'flake.nix',
        contents: fileContent.replace('v2.24.1', 'v2.26.0'),
      },
    ]);
  });
});
