import { IgnoreNodeModulesMigration } from './ignore-node-modules-migration.ts';

describe('config/migrations/custom/ignore-node-modules-migration', () => {
  it('should migrate to ignorePaths', async () => {
    await expect(IgnoreNodeModulesMigration).toMigrate(
      {
        ignoreNodeModules: true,
      },
      { ignorePaths: ['node_modules/'] },
    );
  });
});
