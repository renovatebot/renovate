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
      { includePaths: ['package.json'] }
    );
  });

  it('should still work for wrong config', () => {
    expect(PackageFilesMigration).toMigrate(
      {
        packageRules: [{ labels: ['hello'] }],
        packageFiles: [
          {
            packageFile: 'package.json',
            packageRules: [{ labels: ['bye'] }],
          },
        ],
      },
      {
        includePaths: ['package.json'],
        packageRules: [
          { labels: ['hello'] },
          { labels: ['bye'], paths: ['package.json'] },
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
              { labels: ['bye'], packageRules: [{ addLabels: ['dear'] }] },
            ],
          },
        ],
      },
      {
        includePaths: ['package.json'],
        packageRules: [
          { addLabels: ['dear'], labels: ['bye'], paths: ['package.json'] },
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
