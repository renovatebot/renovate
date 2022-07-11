import { DepTypesMigration } from './dep-types-migration';

describe('config/migrations/custom/dep-types-migration', () => {
  it('should only add depTypes to packageRules', () => {
    expect(DepTypesMigration).toMigrate(
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
        ],
      },
      {
        peerDependencies: {
          versionStrategy: 'widen',
        },
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
            respectLatest: false,
          },
        ],
      }
    );
  });

  it('should migrate depTypes', () => {
    expect(DepTypesMigration).toMigrate(
      {
        depTypes: [
          'dependencies',
          {
            depType: 'optionalDependencies',
            respectLatest: false,
          },
        ],
      },
      {
        packageRules: [
          {
            matchDepTypes: ['optionalDependencies'],
            respectLatest: false,
          },
        ],
      }
    );
  });
});
