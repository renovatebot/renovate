import { DepTypesMigration } from './dep-types-migration';

describe('config/migrations/custom/dep-types-migration', () => {
  it('should only add depTypes to packageRules', () => {
    expect(DepTypesMigration).toMigrate(
      {
        peerDependencies: {
          versionStrategy: 'widen',
        },
        dependencies: {
          versionStrategy: 'widen',
        },
        engines: {
          rangeStrategy: 'auto',
        },
        optionalDependencies: {
          versionStrategy: 'widen',
        },
        devDependencies: {
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
            matchDepTypes: ['peerDependencies'],
            versionStrategy: 'widen',
          },
          {
            matchDepTypes: ['dependencies'],
            versionStrategy: 'widen',
          },
          {
            matchDepTypes: ['engines'],
            rangeStrategy: 'auto',
          },
          {
            matchDepTypes: ['optionalDependencies'],
            versionStrategy: 'widen',
          },
          {
            matchDepTypes: ['devDependencies'],
            versionStrategy: 'widen',
          },
          {
            matchDepTypes: ['optionalDependencies'],
            respectLatest: false,
          },
        ],
      },
    );
  });
});
