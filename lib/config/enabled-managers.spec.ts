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
    ).toStrictEqual({ ...config, enabledManagers: [] });
  });
  it('changes enabled flag for enabled managers', () => {
    expect(
      applyEnabledManagersFilter({
        ...config,
        enabledManagers: ['foobar', 'maven'],
      })
    ).toStrictEqual({
      enabledManagers: [],
      npm: { enabled: false },
      maven: { enabled: true },
    });
  });
});
