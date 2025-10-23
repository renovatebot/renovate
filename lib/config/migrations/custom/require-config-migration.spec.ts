import type { RequiredConfig } from '../../types';
import { RequireConfigMigration } from './require-config-migration';

describe('config/migrations/custom/require-config-migration', () => {
  it('should migrate requireConfig=true to requireConfig=required', async () => {
    await expect(RequireConfigMigration).toMigrate(
      {
        requireConfig: 'true' as RequiredConfig,
      },
      {
        requireConfig: 'required',
      },
    );
  });

  it('should migrate requireConfig=false to requireConfig=optional', async () => {
    await expect(RequireConfigMigration).toMigrate(
      {
        requireConfig: 'false' as RequiredConfig,
      },
      {
        requireConfig: 'optional',
      },
    );
  });
});
