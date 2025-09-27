import { PackageFilesMigration } from './package-files-migration';

describe('config/migrations/custom/package-files-migration', () => {
  it('should migrate value to array', async () => {
    await expect(PackageFilesMigration).toMigrate(
      {
        packageFiles: [
          {
            packageFile: 'package.json',
            packageRules: [],
          },
        ],
      },
      {
        includePaths: ['package.json'],
        packageRules: [{ paths: ['package.json'], packageRules: [] }],
      },
    );
  });

  it('should handle multiple packageFile', async () => {
    await expect(PackageFilesMigration).toMigrate(
      {
        packageFiles: [['package.json', 'Chart.yaml']],
      },
      {
        includePaths: ['package.json', 'Chart.yaml'],
      },
    );
  });

  it('should still work for wrong config', async () => {
    await expect(PackageFilesMigration).toMigrate(
      {
        packageRules: [{ labels: ['lint'] }],
        packageFiles: [
          {
            packageFile: 'package.json',
            packageRules: [{ labels: ['breaking'] }],
          },
        ],
      },
      {
        includePaths: ['package.json'],
        packageRules: [
          { labels: ['lint'] },
          {
            paths: ['package.json'],
            packageRules: [{ labels: ['breaking'] }],
          },
        ],
      },
    );
  });

  it('should work for non-object packageFiles', async () => {
    await expect(PackageFilesMigration).toMigrate(
      {
        packageFiles: ['package.json'],
      },
      {
        includePaths: ['package.json'],
      },
    );
  });

  it('should work for nested rules', async () => {
    await expect(PackageFilesMigration).toMigrate(
      {
        packageFiles: [
          {
            packageFile: 'package.json',
            packageRules: [
              {
                labels: ['linter'],
                packageRules: [{ addLabels: ['es-lint'] }],
              },
            ],
          },
        ],
      },
      {
        includePaths: ['package.json'],
        packageRules: [
          {
            paths: ['package.json'],
            packageRules: [
              {
                labels: ['linter'],
                packageRules: [{ addLabels: ['es-lint'] }],
              },
            ],
          },
        ],
      },
    );
  });

  it('no change for empty packageFiles', async () => {
    await expect(PackageFilesMigration).toMigrate(
      {
        includePaths: ['package.json'],
        packageRules: [{ labels: ['linter'] }],
        packageFiles: [],
      },
      {
        includePaths: ['package.json'],
        packageRules: [{ labels: ['linter'] }],
      },
    );
  });
});
