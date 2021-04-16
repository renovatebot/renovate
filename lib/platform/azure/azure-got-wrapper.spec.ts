import { getName } from '../../../test/util';
import { PLATFORM_TYPE_AZURE } from '../../constants/platforms';
import * as _hostRules from '../../util/host-rules';

describe(getName(__filename), () => {
  let azure: typeof import('./azure-got-wrapper');
  let hostRules: typeof _hostRules;
  beforeEach(() => {
    // reset module
    jest.resetModules();
    hostRules = require('../../util/host-rules');
    azure = require('./azure-got-wrapper');
  });

  describe('gitApi', () => {
    it('should throw an error if no config found', () => {
      expect(azure.gitApi).toThrow('No config found for azure');
      expect(azure.coreApi).toThrow('No config found for azure');
      expect(azure.policyApi).toThrow('No config found for azure');
    });
    it('should set personal access token and endpoint', () => {
      hostRules.add({
        hostType: PLATFORM_TYPE_AZURE,
        token: '1234567890123456789012345678901234567890123456789012',
        baseUrl: 'https://dev.azure.com/renovate1',
      });
      azure.setEndpoint('https://dev.azure.com/renovate1');

      const res = azure.azureObj();

      delete res.rest.client.userAgent;
      delete res.vsoClient.restClient.client.userAgent;

      // We will track if the lib azure-devops-node-api change
      expect(res).toMatchSnapshot();
    });
    it('should set bearer token and endpoint', () => {
      hostRules.add({
        hostType: PLATFORM_TYPE_AZURE,
        token: 'token',
        baseUrl: 'https://dev.azure.com/renovate2',
      });
      azure.setEndpoint('https://dev.azure.com/renovate2');

      const res = azure.azureObj();

      delete res.rest.client.userAgent;
      delete res.vsoClient.restClient.client.userAgent;

      // We will track if the lib azure-devops-node-api change
      expect(res).toMatchSnapshot();
    });

    it('should set password and endpoint', () => {
      hostRules.add({
        hostType: PLATFORM_TYPE_AZURE,
        username: 'user',
        password: 'pass',
        baseUrl: 'https://dev.azure.com/renovate3',
      });
      azure.setEndpoint('https://dev.azure.com/renovate3');

      const res = azure.azureObj();

      delete res.rest.client.userAgent;
      delete res.vsoClient.restClient.client.userAgent;

      // We will track if the lib azure-devops-node-api change
      expect(res).toMatchSnapshot();
    });
  });
});
