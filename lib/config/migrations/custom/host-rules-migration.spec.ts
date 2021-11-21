import { MigrationsService } from '../migrations-service';
import { HostRulesMigration } from './host-rules-migration';

describe('config/migrations/custom/host-rules-migration', () => {
  it('should migrate array', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        hostRules: [
          {
            endpoint: 'testEndpoint',
            platform: 'testPlatform',
          },
        ],
      } as any,
      HostRulesMigration
    );

    expect(migratedConfig.hostRules).toEqual([
      {
        hostType: 'testPlatform',
        matchHost: 'testEndpoint',
      },
    ]);
  });
});
