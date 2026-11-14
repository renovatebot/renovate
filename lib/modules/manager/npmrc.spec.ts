import { needsNpmrcFromDisk, withNpmrc, withoutNpmrc } from './npmrc.ts';
import type { NpmrcPackageFile, PackageFile } from './types.ts';

describe('modules/manager/npmrc', () => {
  const repoNpmrc = {
    fileName: '.npmrc',
    content: 'registry=https://reg.example.com/\n',
    detectedLineEnding: '\n' as const,
  };
  const npmFile: NpmrcPackageFile = {
    packageFile: 'package.json',
    npmrc: 'merged',
    managerData: { npmrcFileName: '.npmrc', repoNpmrc },
    deps: [],
  };
  const gradleFile: PackageFile = { packageFile: 'build.gradle', deps: [] };
  const packageFiles: Record<string, PackageFile[]> = {
    npm: [npmFile],
    gradle: [gradleFile],
  };

  describe('withoutNpmrc', () => {
    it('strips the npmrc of managers with supportsNpmrc only', () => {
      const result = withoutNpmrc(packageFiles);

      expect(result.npm[0]).toEqual({
        packageFile: 'package.json',
        managerData: { npmrcFileName: '.npmrc', repoNpmrc },
        deps: [],
      });
      expect(result.gradle[0]).toBe(gradleFile);
      expect(npmFile.npmrc).toBe('merged');
    });

    it('handles missing package files', () => {
      expect(withoutNpmrc(undefined as never)).toEqual({});
    });
  });

  describe('withNpmrc', () => {
    it('rebuilds the npmrc of managers with supportsNpmrc only', async () => {
      const result = await withNpmrc(withoutNpmrc(packageFiles), {
        npmrc: 'config',
        npmrcMerge: true,
      });

      expect((result.npm[0] as NpmrcPackageFile).npmrc).toBe(
        `config\n${repoNpmrc.content}`,
      );
      expect(result.gradle[0]).toBe(gradleFile);
    });
  });

  describe('needsNpmrcFromDisk', () => {
    it('checks the package files of managers with supportsNpmrc only', () => {
      expect(needsNpmrcFromDisk(packageFiles)).toBeFalse();
      expect(
        needsNpmrcFromDisk({
          gradle: [
            { ...gradleFile, managerData: { uncachedNpmrcFileName: '.npmrc' } },
          ],
        }),
      ).toBeFalse();
      expect(
        needsNpmrcFromDisk({
          bun: [
            { ...npmFile, managerData: { uncachedNpmrcFileName: '.npmrc' } },
          ],
        }),
      ).toBeTrue();
    });

    it('does not need the npmrc of a package file with an npmrcFileName only', () => {
      expect(
        needsNpmrcFromDisk({
          npm: [
            {
              packageFile: 'package.json',
              managerData: { npmrcFileName: '.npmrc' },
              deps: [],
            },
          ],
        }),
      ).toBeFalse();
    });
  });
});
