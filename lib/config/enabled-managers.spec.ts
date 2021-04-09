import { applyEnabledManagersFilter } from './enabled-managers';
import { RenovateConfig } from './types';

describe('config/enabled-managers', () => {
  const config: RenovateConfig = {
    npm: {
      enabled: true,
    },
    maven: {
      enabled: false,
    },
  };
  it('ignores config changes when enabledManagers is empty', () => {
    expect(applyEnabledManagersFilter(config)).toStrictEqual(config);
    expect(
      applyEnabledManagersFilter({ ...config, enabledManagers: ['foobar'] })
    ).toStrictEqual({ ...config, enabledManagers: ['foobar'] });
  });
  it('changes enabled flag for enabled managers', () => {
    expect(
      applyEnabledManagersFilter({
        enabledManagers: ['foobar', 'maven'],
        ...config,
      })
    ).toStrictEqual({
      enabledManagers: ['foobar', 'maven'],
      npm: { enabled: false },
      maven: { enabled: true },
    });
  });
});
