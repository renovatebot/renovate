import { PathRulesMigration } from './path-rules-migration';

describe('config/migrations/custom/path-rules-migration', () => {
  it('should migrate to ignorePaths', () => {
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
      }
    );
  });
});
