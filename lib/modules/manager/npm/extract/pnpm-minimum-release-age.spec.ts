import { fs } from '~test/util.ts';
import { calculateMinimumReleaseAgeMs } from '../../../../util/minimum-release-age.ts';
import { toMs } from '../../../../util/pretty-time.ts';
import type { PackageFile } from '../../types.ts';
import type { NpmManagerData } from '../types.ts';
import {
  getPnpmMinimumReleaseAgeMinutes,
  readPnpmWorkspaceMinimumReleaseAge,
  setPnpmMinimumReleaseAge,
} from './pnpm-minimum-release-age.ts';

vi.mock('../../../../util/fs/index.ts');

function mockWorkspace(content: string | null): void {
  fs.readLocalFile.mockImplementation((fileName: string) =>
    Promise.resolve(
      fileName === 'some-dir/pnpm-workspace.yaml' ? content : null,
    ),
  );
}

describe('modules/manager/npm/extract/pnpm-minimum-release-age', () => {
  describe('readPnpmWorkspaceMinimumReleaseAge()', () => {
    it.each`
      content                                                       | expected
      ${null}                                                       | ${{}}
      ${'packages:\n  - pkgs/*\n'}                                  | ${{}}
      ${'- not a mapping\n'}                                        | ${{}}
      ${'minimumReleaseAge: 1440\n'}                                | ${{ minimumReleaseAge: 1440 }}
      ${'minimumReleaseAge: -1\n'}                                  | ${{}}
      ${'minimumReleaseAge: bananas\nminimumReleaseAgeStrict: 1\n'} | ${{}}
      ${'minimumReleaseAge: 60\nminimumReleaseAgeStrict: false\n'}  | ${{ minimumReleaseAge: 60, minimumReleaseAgeStrict: false }}
    `('returns $expected for $content', async ({ content, expected }) => {
      mockWorkspace(content);

      await expect(
        readPnpmWorkspaceMinimumReleaseAge('some-dir/pnpm-lock.yaml'),
      ).resolves.toEqual(expected);
    });
  });

  describe('setPnpmMinimumReleaseAge()', () => {
    function packageFile(
      packageFile: string,
      managerData?: NpmManagerData,
    ): Partial<PackageFile<NpmManagerData>> {
      return { packageFile, managerData };
    }

    it('sets minimumReleaseAgeExtracted on the package files which pnpm manages', async () => {
      mockWorkspace('minimumReleaseAge: 1440\n');
      const packageFiles = [
        packageFile('some-dir/package.json', {
          pnpmLockFile: 'some-dir/pnpm-lock.yaml',
        }),
        packageFile('some-dir/pkgs/a/package.json', {
          pnpmLockFile: 'some-dir/pnpm-lock.yaml',
        }),
        packageFile('some-dir/pnpm-workspace.yaml', {
          pnpmLockFile: 'some-dir/pnpm-lock.yaml',
        }),
        packageFile('other/package.json', {
          npmLock: 'other/package-lock.json',
        }),
        packageFile('none/package.json'),
      ];

      await setPnpmMinimumReleaseAge(packageFiles);

      expect(packageFiles.map((p) => p.minimumReleaseAgeExtracted)).toEqual([
        '1440 minutes',
        '1440 minutes',
        '1440 minutes',
        undefined,
        undefined,
      ]);
      // the workspace file is read once per lock file
      expect(fs.readLocalFile).toHaveBeenCalledOnce();
    });

    it('uses the larger of the pnpm-workspace.yaml value and minimumReleaseAge', async () => {
      mockWorkspace('minimumReleaseAge: 1440\n');
      const packageFiles = [
        packageFile('some-dir/package.json', {
          pnpmLockFile: 'some-dir/pnpm-lock.yaml',
        }),
      ];

      await setPnpmMinimumReleaseAge(packageFiles);

      expect(
        calculateMinimumReleaseAgeMs({
          minimumReleaseAge: '7 days',
          minimumReleaseAgeExtracted:
            packageFiles[0].minimumReleaseAgeExtracted,
        }),
      ).toBe(toMs('7 days'));
      expect(
        calculateMinimumReleaseAgeMs({
          minimumReleaseAge: '1 hour',
          minimumReleaseAgeExtracted:
            packageFiles[0].minimumReleaseAgeExtracted,
        }),
      ).toBe(toMs('1 day'));
    });

    it.each`
      content
      ${null}
      ${'minimumReleaseAge: 0\n'}
    `(
      'skips package files without a minimum release age: $content',
      async ({ content }) => {
        mockWorkspace(content);
        const packageFiles = [
          packageFile('some-dir/package.json', {
            pnpmLockFile: 'some-dir/pnpm-lock.yaml',
          }),
        ];

        await setPnpmMinimumReleaseAge(packageFiles);

        expect(packageFiles[0].minimumReleaseAgeExtracted).toBeUndefined();
      },
    );

    it.each`
      pnpm          | workspace                    | expected
      ${'^10.20.0'} | ${null}                      | ${'2880 minutes'}
      ${'^10.20.0'} | ${'minimumReleaseAge: 60\n'} | ${'60 minutes'}
      ${'^11.0.0'}  | ${null}                      | ${undefined}
      ${undefined}  | ${null}                      | ${undefined}
    `(
      'reads the repository .npmrc for pnpm $pnpm and workspace=$workspace',
      async ({ pnpm, workspace, expected }) => {
        mockWorkspace(workspace);
        const packageFiles: Partial<PackageFile<NpmManagerData>>[] = [
          {
            packageFile: 'some-dir/package.json',
            extractedConstraints: { pnpm },
            managerData: {
              pnpmLockFile: 'some-dir/pnpm-lock.yaml',
              repoNpmrc: {
                fileName: '.npmrc',
                content: 'minimum-release-age=2880\n',
                detectedLineEnding: '\n',
              },
            },
          },
        ];

        await setPnpmMinimumReleaseAge(packageFiles);

        expect(packageFiles[0].minimumReleaseAgeExtracted).toBe(expected);
      },
    );
  });

  describe('getPnpmMinimumReleaseAgeMinutes()', () => {
    const npmrc = 'minimum-release-age=2880\n';

    it.each`
      workspace                   | pnpm          | includeDefault | expected
      ${{}}                       | ${'^10.20.0'} | ${true}        | ${2880}
      ${{}}                       | ${'^10.20.0'} | ${false}       | ${2880}
      ${{ minimumReleaseAge: 0 }} | ${'^10.20.0'} | ${true}        | ${0}
      ${{ minimumReleaseAge: 0 }} | ${'^11.0.0'}  | ${true}        | ${0}
      ${{}}                       | ${'^11.0.0'}  | ${true}        | ${1440}
      ${{}}                       | ${'^11.0.0'}  | ${false}       | ${undefined}
      ${{}}                       | ${'>=10'}     | ${true}        | ${1440}
      ${{}}                       | ${'bananas'}  | ${true}        | ${1440}
      ${{}}                       | ${null}       | ${true}        | ${1440}
    `(
      'returns $expected for workspace=$workspace, pnpm $pnpm and includeDefault=$includeDefault',
      ({ workspace, pnpm, includeDefault, expected }) => {
        expect(
          getPnpmMinimumReleaseAgeMinutes(
            workspace,
            npmrc,
            pnpm,
            includeDefault,
          ),
        ).toBe(expected);
      },
    );

    it('returns undefined for pnpm v10 without a setting', () => {
      expect(
        getPnpmMinimumReleaseAgeMinutes({}, null, '^10.20.0', true),
      ).toBeUndefined();
    });
  });
});
