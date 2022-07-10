import { PeerDependenciesMigration } from './peer-dependencies-migration';

describe('config/migrations/custom/peer-dependencies-migration', () => {
  it('should only add depTypes to packageRules', () => {
    expect(PeerDependenciesMigration).toMigrate(
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
          {
            matchDepTypes: ['peerDependencies'],
            versionStrategy: 'widen',
          },
        ],
      }
    );
  });
});
