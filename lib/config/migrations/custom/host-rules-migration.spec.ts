import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/host-rules-migration', () => {
  it('should migrate inner fields of array items', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      hostRules: [
        {
          endpoint: 'testEndpoint',
          platform: 'testPlatform',
        },
        { baseUrl: 'https://some.domain.com', token: '123test' },
        { domainName: 'domain.com', token: '123test' },
        { hostName: 'some.domain.com', token: '123test' },
      ],
    } as any);

    expect(isMigrated).toBeTrue();
    expect(migratedConfig.hostRules).toEqual([
      {
        hostType: 'testPlatform',
        matchHost: 'testEndpoint',
      },
      { matchHost: 'https://some.domain.com', token: '123test' },
      { matchHost: 'domain.com', token: '123test' },
      { matchHost: 'some.domain.com', token: '123test' },
    ]);
  });
});
