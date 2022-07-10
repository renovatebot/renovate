import { DependenciesMigration } from './dependencies-migration';

describe('config/migrations/custom/dependencies-migration', () => {
  it('should only add depTypes to packageRules', () => {
    expect(DependenciesMigration).toMigrate(
      {
        peerDependencies: {
          versionStrategy: 'widen',
        },
        dependencies: {
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
            matchDepTypes: ['dependencies'],
            versionStrategy: 'widen',
          },
        ],
      }
    );
  });
});
