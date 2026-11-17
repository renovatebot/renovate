import { logger } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { filterAllowedEnv } from './filter-allowed-env.ts';

describe('workers/repository/init/filter-allowed-env', () => {
  beforeEach(() => {
    GlobalConfig.reset();
  });

  it('returns undefined when env is undefined', () => {
    expect(filterAllowedEnv(undefined)).toBeUndefined();
  });

  it('keeps env matching allowedEnv and drops the rest with a warning', () => {
    GlobalConfig.set({ allowedEnv: ['GO*'] });

    const result = filterAllowedEnv({
      GOFLAGS: '-mod=vendor',
      GIT_SSH_COMMAND: 'sh -c "malicious"',
    });

    expect(result).toEqual({ GOFLAGS: '-mod=vendor' });
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { denied: ['GIT_SSH_COMMAND'] },
      "Ignoring env variables not permitted by this Renovate instance's `allowedEnv`",
    );
  });

  it('drops all env when allowedEnv is unset (deny by default)', () => {
    expect(filterAllowedEnv({ ANYTHING: 'x' })).toEqual({});
  });
  it('keeps env the self-hosted admin supplied themselves', () => {
    expect(
      filterAllowedEnv(
        { ADMIN_VAR: 'set-by-admin', REPO_VAR: 'set-by-repo' },
        { ADMIN_VAR: 'set-by-admin' },
      ),
    ).toEqual({ ADMIN_VAR: 'set-by-admin' });
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { denied: ['REPO_VAR'] },
      "Ignoring env variables not permitted by this Renovate instance's `allowedEnv`",
    );
  });

  it('keeps the self-hosted admin env the repo config replaced wholesale', () => {
    // `env` is not `mergeable`, so a repo setting its own `env` drops the self-hosted admin's names entirely
    expect(
      filterAllowedEnv(
        { REPO_VAR: 'set-by-repo' },
        { ADMIN_VAR: 'set-by-admin' },
      ),
    ).toEqual({ ADMIN_VAR: 'set-by-admin' });
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { denied: ['REPO_VAR'] },
      "Ignoring env variables not permitted by this Renovate instance's `allowedEnv`",
    );
  });

  it('lets repo config blank a self-hosted admin value for a name it may set', () => {
    // an empty value is still an override, so a repository can effectively unset one of the admin's variables - as long as `allowedEnv` lets it set that name at all
    GlobalConfig.set({ allowedEnv: ['ADMIN_VAR'] });

    expect(
      filterAllowedEnv({ ADMIN_VAR: '' }, { ADMIN_VAR: 'set-by-admin' }),
    ).toEqual({ ADMIN_VAR: '' });
    expect(logger.logger.warn).not.toHaveBeenCalled();
  });

  it('keeps the self-hosted admin value when repo config blanks a name it may not set', () => {
    expect(
      filterAllowedEnv({ ADMIN_VAR: '' }, { ADMIN_VAR: 'set-by-admin' }),
    ).toEqual({ ADMIN_VAR: 'set-by-admin' });
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { denied: ['ADMIN_VAR'] },
      "Ignoring env variables not permitted by this Renovate instance's `allowedEnv`",
    );
  });

  it('keeps the self-hosted admin value when repo config overrides a name it may not set', () => {
    expect(
      filterAllowedEnv(
        { ADMIN_VAR: 'set-by-repo' },
        { ADMIN_VAR: 'set-by-admin' },
      ),
    ).toEqual({ ADMIN_VAR: 'set-by-admin' });
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { denied: ['ADMIN_VAR'] },
      "Ignoring env variables not permitted by this Renovate instance's `allowedEnv`",
    );
  });
});
