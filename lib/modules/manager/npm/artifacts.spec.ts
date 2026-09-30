import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import type { FileAddition } from '../../../util/git/types.ts';
import type { UpdateArtifactsConfig, Upgrade } from '../types.ts';
import { updateArtifacts } from './index.ts';

vi.mock('../../../util/fs/index.ts');

// 32-byte digest, as used by sha256
const sha256HexDigest = 'abcdef0123456789'.repeat(4);
// 48-byte digest, as used by sha384
const sha384HexDigest = 'abcdef0123456789'.repeat(6);
// 64-byte digest, as used by sha512
const sha512HexDigest = 'abcdef0123456789'.repeat(8);

function sriDigest(algo: string, hexDigest: string): string {
  return `${algo}-${Buffer.from(hexDigest, 'hex').toString('base64')}`;
}

const config: UpdateArtifactsConfig = {};
const validDepUpdate = {
  depName: 'pnpm',
  depType: 'packageManager',
  currentValue: `8.15.5+sha256.${sha256HexDigest}`,
  newVersion: '8.15.6',
  newDigest: sriDigest('sha512', sha512HexDigest),
} satisfies Upgrade<Record<string, unknown>>;

describe('modules/manager/npm/artifacts', () => {
  it('returns null if no packageManager updates present', async () => {
    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ ...validDepUpdate, depName: 'xmldoc', depType: 'patch' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toBeNull();
  });

  it('returns null if currentValue is undefined', async () => {
    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ ...validDepUpdate, currentValue: undefined }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toBeNull();
  });

  it('returns null if currentValue has no hash', async () => {
    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ ...validDepUpdate, currentValue: '8.15.5' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toBeNull();
  });

  it('returns null if unchanged', async () => {
    const newPackageFileContent = codeBlock`
      {
        "packageManager": "pnpm@8.15.6+sha512.${sha512HexDigest}"
      }
    `;

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent,
      config,
    });

    expect(res).toBeNull();
  });

  it('returns updated package.json using the sha512 digest', async () => {
    const newPackageFileContent = codeBlock`
      {
        "name": "some-repo",
        "packageManager": "pnpm@8.15.5+sha256.${sha256HexDigest}",
        "dependencies": {
          "foo": "1.0.0"
        }
      }
    `;

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent,
      config,
    });

    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: 'package.json',
          contents: codeBlock`
            {
              "name": "some-repo",
              "packageManager": "pnpm@8.15.6+sha512.${sha512HexDigest}",
              "dependencies": {
                "foo": "1.0.0"
              }
            }
          `,
        },
      },
    ]);
  });

  it('preserves compact formatting when replacing the packageManager value', async () => {
    const newPackageFileContent = `{"name":"some-repo","packageManager":"pnpm@8.15.5+sha256.${sha256HexDigest}"}`;

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent,
      config,
    });

    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: 'package.json',
          contents: `{"name":"some-repo","packageManager":"pnpm@8.15.6+sha512.${sha512HexDigest}"}`,
        },
      },
    ]);
  });

  it('supports a sha256 digest', async () => {
    const newPackageFileContent = codeBlock`
      {
        "packageManager": "pnpm@8.15.5+sha256.${sha256HexDigest}"
      }
    `;

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [
        { ...validDepUpdate, newDigest: sriDigest('sha256', sha256HexDigest) },
      ],
      newPackageFileContent,
      config,
    });

    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: 'package.json',
          contents: codeBlock`
            {
              "packageManager": "pnpm@8.15.6+sha256.${sha256HexDigest}"
            }
          `,
        },
      },
    ]);
  });

  it('supports a sha384 digest', async () => {
    const newPackageFileContent = codeBlock`
      {
        "packageManager": "pnpm@8.15.5+sha256.${sha256HexDigest}"
      }
    `;

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [
        { ...validDepUpdate, newDigest: sriDigest('sha384', sha384HexDigest) },
      ],
      newPackageFileContent,
      config,
    });

    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: 'package.json',
          contents: codeBlock`
            {
              "packageManager": "pnpm@8.15.6+sha384.${sha384HexDigest}"
            }
          `,
        },
      },
    ]);
  });

  it('returns an artifactError if newDigest is missing', async () => {
    const newPackageFileContent = codeBlock`
      {
        "packageManager": "pnpm@8.15.5+sha256.${sha256HexDigest}"
      }
    `;

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [{ ...validDepUpdate, newDigest: undefined }],
      newPackageFileContent,
      config,
    });

    expect(res).toEqual([
      {
        artifactError: {
          fileName: 'package.json',
          stderr:
            'Cannot update packageManager hash for pnpm@8.15.6: no valid digest available',
        },
      },
    ]);
  });

  it('returns an artifactError if newDigest is not a valid SRI string', async () => {
    const newPackageFileContent = codeBlock`
      {
        "packageManager": "pnpm@8.15.5+sha256.${sha256HexDigest}"
      }
    `;

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [{ ...validDepUpdate, newDigest: 'not-a-valid-digest' }],
      newPackageFileContent,
      config,
    });

    expect(res).toEqual([
      {
        artifactError: {
          fileName: 'package.json',
          stderr:
            'Cannot update packageManager hash for pnpm@8.15.6: no valid digest available',
        },
      },
    ]);
  });

  it('returns null if the packageManager field cannot be found in the content', async () => {
    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: '{"name":"some-repo"}',
      config,
    });

    expect(res).toBeNull();
  });

  describe('updatePnpmWorkspace()', () => {
    it('returns null if no security updates are found', async () => {
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [{ ...validDepUpdate, currentValue: '8.15.5' }],
        newPackageFileContent: 'some new content',
        config,
      });

      expect(res).toBeNull();
    });

    it('returns null if pnpm workspace file does not exist', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(false);
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            currentValue: '8.15.5',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });

      expect(res).toBeNull();
    });

    it('returns null if the pnpmLockFile file is not found', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080`,
      );
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            currentValue: '8.15.5',
            managerData: {
              // to be super explicit it's not set
              pnpmLockFile: undefined,

              // data from testing in https://github.com/JamieTanna-Mend-testing/pnpm-test-mra-no-workspace/pull/3
              hasPackageManager: false,
              npmrcFileName: null,
              yarnZeroInstall: false,
            },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });

      expect(res).toBeNull();
    });

    it('returns null if no minimumReleaseAge setting found', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(''); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            currentValue: '8.15.5',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });

      expect(res).toBeNull();
    });

    it('returns null if minimumReleaseAgeExclude excludes all versions of updated dep', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080
minimumReleaseAgeExclude:
  - '@myorg/*'
  - pnpm`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            currentValue: '8.15.5',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
          {
            ...validDepUpdate,
            depName: '@myorg/fs-alternative',
            currentValue: '8.15.5',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });

      expect(res).toBeNull();
    });

    it('updates pnpm workspace - adds minimumReleaseAgeExclude block if not found', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            currentValue: '8.15.5',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  # Renovate security update: pnpm@8.15.6\n  - pnpm@8.15.6\n',
          },
        },
      ]);
    });

    it('updates pnpm workspace - appends new minimumReleaseAgeExclude setting', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080
minimumReleaseAgeExclude:
  - otherdep@5.6.7`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            currentValue: '8.15.5',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  - otherdep@5.6.7\n  # Renovate security update: pnpm@8.15.6\n  - pnpm@8.15.6\n',
          },
        },
      ]);
    });

    it('updates pnpm workspace - expands existing minimumReleaseAgeExclude setting', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080
minimumReleaseAgeExclude:
  - pnpm@5.6.7
  - '@next/env@16.0.7 || 16.0.9'`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            currentValue: '8.15.5',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
          {
            ...validDepUpdate,
            depName: '@next/env',
            depType: 'dependency',
            currentValue: '16.0.9',
            newVersion: '16.0.10',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              "minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  # Renovate security update: pnpm@8.15.6\n  - pnpm@5.6.7 || 8.15.6\n  # Renovate security update: @next/env@16.0.10\n  - '@next/env@16.0.7 || 16.0.9 || 16.0.10'\n",
          },
        },
      ]);
    });

    it('updates pnpm workspace - handles comment with version already present on an inner minimumReleaseAgeExclude setting', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080
minimumReleaseAgeExclude:
  - pnpm@5.6.7
  # Renovate security update: lodash@4.17.21 || 4.17.23
  - lodash@4.17.23`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            depType: 'devDependencies',
            currentValue: '^4.17.15',
            currentVersion: '4.17.21',
            newVersion: '4.17.23',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      // no changes needed
      expect(res).toBeNull();
    });

    it('updates pnpm workspace - handles comment on an inner minimumReleaseAgeExclude setting', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080
minimumReleaseAgeExclude:
  - pnpm@5.6.7
  # Renovate security update: lodash@4.17.21
  - lodash@4.17.21`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            depType: 'devDependencies',
            currentValue: '^4.17.15',
            currentVersion: '4.17.21',
            newVersion: '4.17.23',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  - pnpm@5.6.7\n  # Renovate security update: lodash@4.17.21 || 4.17.23\n  - lodash@4.17.21 || 4.17.23\n',
          },
        },
      ]);
    });

    // As per https://github.com/renovatebot/renovate/issues/40610, we don't want to allow version constraints with i.e. a caret like `^4.17.15`
    it('updates pnpm workspace - uses newVersion over newValue in minimumReleaseAgeExclude', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            depType: 'devDependencies',
            currentValue: '^4.17.15',
            currentVersion: '4.17.21',
            newVersion: '4.17.23',
            newValue: '^4.17.15',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  # Renovate security update: lodash@4.17.23\n  - lodash@4.17.23\n',
          },
        },
      ]);
    });

    it('handles multiple security upgrades of the same package (at different versions) in a monorepo', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);

      // for the first package file
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080`,
      ); // for pnpm-workspace.yaml
      let res = await updateArtifacts({
        packageFileName: 'packages/a/package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            depType: 'dependencies',
            currentValue: '4.17.20',
            newVersion: '4.17.21',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  # Renovate security update: lodash@4.17.21\n  - lodash@4.17.21\n',
          },
        },
      ]);
      expect(res).not.toBeNull();

      const addition = res![0].file as FileAddition;
      const newContents = addition.contents as string;

      // then for the next update
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(newContents); // for pnpm-workspace.yaml

      res = await updateArtifacts({
        packageFileName: 'packages/b/package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            depType: 'devDependencies',
            currentValue: '4.17.20',
            newVersion: '4.17.23',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  # Renovate security update: lodash@4.17.21 || 4.17.23\n  - lodash@4.17.21 || 4.17.23\n',
          },
        },
      ]);
    });

    it('handles multiple security upgrades of the same package (at the same version) in a monorepo', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);

      // for the first package file
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080`,
      ); // for pnpm-workspace.yaml
      let res = await updateArtifacts({
        packageFileName: 'packages/a/package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            depType: 'dependencies',
            currentValue: '4.17.20',
            newVersion: '4.17.21',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  # Renovate security update: lodash@4.17.21\n  - lodash@4.17.21\n',
          },
        },
      ]);
      expect(res).not.toBeNull();

      const addition = res![0].file as FileAddition;
      const newContents = addition.contents as string;

      // then for the next update
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(newContents); // for pnpm-workspace.yaml

      res = await updateArtifacts({
        packageFileName: 'packages/b/package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            depType: 'devDependencies',
            currentValue: '4.17.20',
            newVersion: '4.17.21',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      // no updates are needed, as they're at the same version
      expect(res).toBeNull();
    });

    it('replaces malformed minimumReleaseAgeExclude entries from prior Renovate bug', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 4320
minimumReleaseAgeExclude:
  - fast-xml-parser@<=5.3.5@5.5.7`,
      );
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'fast-xml-parser@<=5.3.5',
            packageName: 'fast-xml-parser',
            depType: 'pnpm.overrides',
            currentValue: '5.3.5',
            newVersion: '5.5.7',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents: `${codeBlock`
              minimumReleaseAge: 4320
              minimumReleaseAgeExclude:
                # Renovate security update: fast-xml-parser@5.5.7
                - fast-xml-parser@5.5.7
            `}\n`,
          },
        },
      ]);
    });

    it('appends to valid minimumReleaseAgeExclude when malformed entry also exists', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 4320
minimumReleaseAgeExclude:
  - fast-xml-parser@5.5.6
  - fast-xml-parser@<=5.3.5@5.5.7`,
      );
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'fast-xml-parser@<=5.3.5',
            packageName: 'fast-xml-parser',
            depType: 'pnpm.overrides',
            currentValue: '5.5.6',
            newVersion: '5.5.7',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents: `${codeBlock`
              minimumReleaseAge: 4320
              minimumReleaseAgeExclude:
                # Renovate security update: fast-xml-parser@5.5.7
                - fast-xml-parser@5.5.6 || 5.5.7
            `}\n`,
          },
        },
      ]);
    });

    it('uses packageName (bare package name) for pnpm overrides with range selectors', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 4320`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'fast-xml-parser@<=5.3.5',
            packageName: 'fast-xml-parser',
            depType: 'pnpm.overrides',
            currentValue: '5.3.5',
            newVersion: '5.5.7',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents: `${codeBlock`
              minimumReleaseAge: 4320
              minimumReleaseAgeExclude:
                # Renovate security update: fast-xml-parser@5.5.7
                - fast-xml-parser@5.5.7
            `}\n`,
          },
        },
      ]);
    });

    it('preserves catalog changes in pnpm-workspace.yaml when adding minimumReleaseAgeExclude', async () => {
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`
          minimumReleaseAge: 10080
          catalog:
            effect: ^3.19.0`,
      );
      const newPackageFileContent = codeBlock`
        minimumReleaseAge: 10080
        catalog:
          effect: ^3.20.0`;
      const res = await updateArtifacts({
        packageFileName: 'pnpm-workspace.yaml',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'effect',
            depType: 'pnpm.catalog.default',
            currentValue: '^3.19.0',
            newVersion: '3.20.0',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent,
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\ncatalog:\n  effect: ^3.20.0\nminimumReleaseAgeExclude:\n  # Renovate security update: effect@3.20.0\n  - effect@3.20.0\n',
          },
        },
      ]);
    });

    it('handles multiple security upgrades correctly (bug fix test)', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            currentValue: '4.17.20',
            newVersion: '4.17.21',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
          {
            ...validDepUpdate,
            depName: 'axios',
            currentValue: '0.21.0',
            newVersion: '0.21.1',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      // Both upgrades should be present - this confirms the oldContent bug fix
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  # Renovate security update: lodash@4.17.21\n  - lodash@4.17.21\n  # Renovate security update: axios@0.21.1\n  - axios@0.21.1\n',
          },
        },
      ]);
    });
  });
});
