import { PathRulesMigration } from './path-rules-migration';

describe('config/migrations/custom/path-rules-migration', () => {
  it('should migrate to packageRules', () => {
    expect(PathRulesMigration).toMigrate(
      {
        pathRules: [
          {
            paths: ['examples/**'],
            extends: ['foo'],
          },
        ],
      },
      {
        packageRules: [
          {
            paths: ['examples/**'],
            extends: ['foo'],
          },
        ],
      },
    );
  });

  it('should rewrite packageRules when it is not array', () => {
    expect(PathRulesMigration).toMigrate(
      {
        packageRules: 'test',
        pathRules: [
          {
            paths: ['examples/**'],
            extends: ['foo'],
          },
        ],
      } as any,
      {
        packageRules: [
          {
            paths: ['examples/**'],
            extends: ['foo'],
          },
        ],
      },
    );
  });

  it('should not migrate non array value', () => {
    expect(PathRulesMigration).toMigrate(
      {
        pathRules: 'test',
      },
      {},
    );
  });

  it('should concat with existing package rules', () => {
    expect(PathRulesMigration).toMigrate(
      {
        pathRules: [
          {
            paths: ['examples/**'],
            extends: ['foo'],
          },
        ],
        packageRules: [
          {
            packageNames: ['guava'],
            versionScheme: 'maven',
          },
        ],
      },
      {
        packageRules: [
          {
            packageNames: ['guava'],
            versionScheme: 'maven',
          },
          {
            paths: ['examples/**'],
            extends: ['foo'],
          },
        ],
      },
    );
  });
});
