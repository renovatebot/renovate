import { logger } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { filterAllowedHeaders } from './filter-allowed-headers.ts';

describe('workers/repository/init/filter-allowed-headers', () => {
  beforeEach(() => {
    GlobalConfig.reset();
  });

  it('leaves rules without headers untouched', () => {
    const rules = [{ matchHost: 'registry.example.com' }];

    expect(filterAllowedHeaders(rules)).toEqual(rules);
    expect(logger.logger.warn).not.toHaveBeenCalled();
  });

  it('keeps headers matching allowedHeaders and drops the rest with a warning', () => {
    GlobalConfig.set({ allowedHeaders: ['X-*'] });

    expect(
      filterAllowedHeaders([
        {
          matchHost: 'registry.example.com',
          headers: { 'X-Allowed': 'yes', Authorization: 'Bearer secret' },
        },
      ]),
    ).toEqual([
      {
        matchHost: 'registry.example.com',
        headers: { 'X-Allowed': 'yes' },
      },
    ]);
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { denied: ['Authorization'] },
      "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
    );
  });

  it('drops all headers when allowedHeaders is unset (deny by default)', () => {
    expect(
      filterAllowedHeaders([
        { matchHost: 'registry.example.com', headers: { anything: 'x' } },
      ]),
    ).toEqual([{ matchHost: 'registry.example.com', headers: {} }]);
  });

  it('leaves everything but the headers untouched', () => {
    GlobalConfig.set({ allowedHeaders: ['X-*'] });
    const rules = [
      {
        matchHost: 'registry.example.com',
        hostType: 'npm',
        username: 'user',
        password: 'pass',
        token: 'token',
        headers: { 'X-Allowed': 'yes' },
      },
    ];

    expect(filterAllowedHeaders(rules)).toEqual(rules);
    expect(logger.logger.warn).not.toHaveBeenCalled();
  });

  it('prefers an explicitly-passed allowlist over GlobalConfig', () => {
    // used when filtering for a repository before `GlobalConfig` reflects it, i.e. a `repositories[]` entry's own `allowedHeaders` override
    GlobalConfig.set({ allowedHeaders: ['X-*'] });

    expect(
      filterAllowedHeaders(
        [
          {
            matchHost: 'registry.example.com',
            headers: { Authorization: 'from-admin', 'X-Dropped': 'yes' },
          },
        ],
        ['Authorization'],
      ),
    ).toEqual([
      {
        matchHost: 'registry.example.com',
        headers: { Authorization: 'from-admin' },
      },
    ]);
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { denied: ['X-Dropped'] },
      "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
    );
  });

  it('drops a header the self-hosted admin supplied themselves', () => {
    // `allowedHeaders` enforces the checks regardless of whether it's global self-hosted administrator config, or repo config
    expect(
      filterAllowedHeaders([
        {
          matchHost: 'registry.example.com',
          headers: { Authorization: 'set-by-admin' },
        },
      ]),
    ).toEqual([{ matchHost: 'registry.example.com', headers: {} }]);
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { denied: ['Authorization'] },
      "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
    );
  });
});
