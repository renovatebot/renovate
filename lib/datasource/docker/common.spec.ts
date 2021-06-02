import { getName, mocked } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import * as dockerCommon from './common';

const hostRules = mocked(_hostRules);

jest.mock('@aws-sdk/client-ecr');
jest.mock('../../util/host-rules');

describe(getName(), () => {
  beforeEach(() => {
    hostRules.find.mockReturnValue({
      username: 'some-username',
      password: 'some-password',
    });
    hostRules.hosts.mockReturnValue([]);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getRegistryRepository', () => {
    it('handles local registries', () => {
      const res = dockerCommon.getRegistryRepository(
        'registry:5000/org/package',
        'https://index.docker.io'
      );
      expect(res).toMatchInlineSnapshot(`
        Object {
          "dockerRepository": "org/package",
          "registryHost": "https://registry:5000",
        }
      `);
    });
    it('supports registryUrls', () => {
      const res = dockerCommon.getRegistryRepository(
        'my.local.registry/prefix/image',
        'https://my.local.registry/prefix'
      );
      expect(res).toMatchInlineSnapshot(`
        Object {
          "dockerRepository": "prefix/image",
          "registryHost": "https://my.local.registry",
        }
      `);
    });
    it('supports http registryUrls', () => {
      const res = dockerCommon.getRegistryRepository(
        'my.local.registry/prefix/image',
        'http://my.local.registry/prefix'
      );
      expect(res).toMatchInlineSnapshot(`
        Object {
          "dockerRepository": "prefix/image",
          "registryHost": "http://my.local.registry",
        }
      `);
    });
    it('supports schemeless registryUrls', () => {
      const res = dockerCommon.getRegistryRepository(
        'my.local.registry/prefix/image',
        'my.local.registry/prefix'
      );
      expect(res).toMatchInlineSnapshot(`
        Object {
          "dockerRepository": "prefix/image",
          "registryHost": "https://my.local.registry",
        }
      `);
    });
  });
});
