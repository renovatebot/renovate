import { initApis } from '../../../../lib/workers/repository/init/apis';
import { RenovateConfig, getConfig } from '../../../util';

jest.mock('../../../../lib/platform/github');

describe('workers/repository/init/apis', () => {
  describe('initApis', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      config = { ...getConfig() };
      config.errors = [];
      config.warnings = [];
      config.token = 'some-token';
    });
    it('runs', async () => {
      await initApis(config);
    });
  });
});
