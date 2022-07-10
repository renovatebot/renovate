import { OptionalDependenciesMigration } from './optional-dependencies-migration';

describe('config/migrations/custom/optional-dependencies-migration', () => {
  it('should only add depTypes to packageRules', () => {
    expect(OptionalDependenciesMigration).toMigrate(
      {
        peerDependencies: {
          versionStrategy: 'widen',
        },
        optionalDependencies: {
          versionStrategy: 'widen',
        },
        depTypes: [
          'dependencies',
          {
            depType: 'optionalDependencies',
            respectLatest: false,
          },
        ],
        packageRules: [
          {
            packagePatterns: '^(@angular|typescript)' as never,
            groupName: ['angular packages'] as never,
            excludedPackageNames: 'foo',
          },
          {
            packageNames: ['foo'],
            packageRules: [
              {
                depTypeList: ['bar'],
                automerge: true,
              },
            ],
          },
        ],
      },
      {
        peerDependencies: {
          versionStrategy: 'widen',
        },
        depTypes: [
          'dependencies',
          {
            depType: 'optionalDependencies',
            respectLatest: false,
          },
        ],
        packageRules: [
          {
            packagePatterns: '^(@angular|typescript)' as never,
            groupName: ['angular packages'] as never,
            excludedPackageNames: 'foo',
          },
          {
            packageNames: ['foo'],
            packageRules: [
              {
                depTypeList: ['bar'],
                automerge: true,
              },
            ],
          },
          {
            matchDepTypes: ['optionalDependencies'],
            versionStrategy: 'widen',
          },
        ],
      }
    );
  });
});
