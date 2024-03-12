import { IgnoreNodeModulesMigration } from './ignore-node-modules-migration';

describe('config/migrations/custom/ignore-node-modules-migration', () => {
  it('should migrate to ignorePaths', () => {
    expect(IgnoreNodeModulesMigration).toMigrate(
      {
        ignoreNodeModules: true,
      },
      { ignorePaths: ['node_modules/'] },
    );
  });
});
