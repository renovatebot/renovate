import { RenovateConfig, getConfig } from '../../../../test/util';
import { initApis } from './apis';

jest.mock('../../../platform/github');

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
