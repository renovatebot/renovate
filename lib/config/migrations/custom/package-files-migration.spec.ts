import { PackageFilesMigration } from './package-files-migration';

describe('config/migrations/custom/package-files-migration', () => {
  it('should migrate value to array', () => {
    expect(PackageFilesMigration).toMigrate(
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
        packageRules: [{ packageFile: 'package.json', packageRules: [] }],
      }
    );
  });

  it('should still work for wrong config', () => {
    expect(PackageFilesMigration).toMigrate(
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
            packageFile: 'package.json',
            packageRules: [{ labels: ['breaking'] }],
          },
        ],
      }
    );
  });

  it('should work for non-object packageFiles', () => {
    expect(PackageFilesMigration).toMigrate(
      {
        packageFiles: ['package.json'],
      },
      {
        includePaths: ['package.json'],
      }
    );
  });

  it('should work for nested rules', () => {
    expect(PackageFilesMigration).toMigrate(
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
            packageFile: 'package.json',
            packageRules: [
              {
                labels: ['linter'],
                packageRules: [{ addLabels: ['es-lint'] }],
              },
            ],
          },
        ],
      }
    );
  });

  it('no change for empty packageFiles', () => {
    expect(PackageFilesMigration).toMigrate(
      {
        includePaths: ['package.json'],
        packageRules: [{ labels: ['linter'] }],
        packageFiles: [],
      },
      {
        includePaths: ['package.json'],
        packageRules: [{ labels: ['linter'] }],
      }
    );
  });
});
