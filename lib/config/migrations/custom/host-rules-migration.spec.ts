import { CONFIG_VALIDATION } from '../../../constants/error-messages';
import { HostRulesMigration } from './host-rules-migration';

describe('config/migrations/custom/host-rules-migration', () => {
  it('should migrate array', () => {
    expect(HostRulesMigration).toMigrate(
      {
        hostRules: [
          { baseUrl: 'https://some.domain.com', token: '123test' },
          { domainName: 'domain.com', token: '123test' },
          { domainName: 'domain.com/', token: '123test' },
          { matchHost: 'domain.com/', token: '123test' },
          { hostName: 'some.domain.com', token: '123test' },
          { endpoint: 'domain.com/', token: '123test' },
          { host: 'some.domain.com', token: '123test' },
        ],
      } as any,
      {
        hostRules: [
          { matchHost: 'https://some.domain.com', token: '123test' },
          { matchHost: 'domain.com', token: '123test' },
          { matchHost: 'https://domain.com/', token: '123test' },
          { matchHost: 'https://domain.com/', token: '123test' },
          { matchHost: 'some.domain.com', token: '123test' },
          { matchHost: 'https://domain.com/', token: '123test' },
          { matchHost: 'some.domain.com', token: '123test' },
        ],
      }
    );
  });

  it('throws when multiple hosts are present', () => {
    expect(() =>
      new HostRulesMigration(
        {
          hostRules: [
            {
              matchHost: 'https://some.domain.com',
              baseUrl: 'https://some.domain.com',
              token: '123test',
            },
          ],
        } as any,
        {}
      ).run([
        {
          matchHost: 'https://some.domain.com',
          baseUrl: 'https://some.domain.com',
          token: '123test',
        },
      ])
    ).toThrow(CONFIG_VALIDATION);
  });
});
