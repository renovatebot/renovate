import { EnginesMigration } from './engines-migration';

describe('config/migrations/custom/engines-migration', () => {
  it('should only add depTypes to packageRules', () => {
    expect(EnginesMigration).toMigrate(
      {
        peerDependencies: {
          versionStrategy: 'widen',
        },
        engines: {
          rangeStrategy: 'auto',
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
            matchDepTypes: ['engines'],
            rangeStrategy: 'auto',
          },
        ],
      }
    );
  });
});
