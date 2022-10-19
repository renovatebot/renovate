import type { Ecosystem, OsvOffline } from '@renovatebot/osv-offline';
import { mockFn } from 'jest-mock-extended';
import { getConfig } from '../../../../test/util';
import type { PackageFile } from '../../../modules/manager/types';
import { Vulnerabilities } from './vulnerabilities';

const getVulnerabilitiesMock =
  mockFn<typeof OsvOffline.prototype.getVulnerabilities>();
const createMock = jest.fn();

jest.mock('@renovatebot/osv-offline', () => {
  return {
    __esModule: true,
    OsvOffline: class {
      static create() {
        return createMock();
      }
    },
  };
});

describe('workers/repository/process/vulnerabilities', () => {
  describe('create()', () => {
    it('works', async () => {
      await expect(Vulnerabilities.create()).resolves.not.toThrow();
    });

    it('throws when osv-offline error', async () => {
      createMock.mockRejectedValue(new Error());

      await expect(Vulnerabilities.create()).rejects.toThrow();
    });
  });

  describe('fetchVulnerabilities()', () => {
    const config = getConfig();
    const packageFiles: Record<string, PackageFile[]> = {
      npm: [{ deps: [{ depName: 'lodash' }] }],
    };
    let vulnerabilities: Vulnerabilities;

    beforeAll(async () => {
      createMock.mockResolvedValue({
        getVulnerabilities: (ecosystem: Ecosystem, packageName: string) =>
          getVulnerabilitiesMock(ecosystem, packageName),
      });
      vulnerabilities = await Vulnerabilities.create();
    });

    it('works', async () => {
      getVulnerabilitiesMock.mockResolvedValue([
        {
          id: 'ABCD',
          modified: new Date(),
          affected: [
            {
              ranges: [{ type: 'SEMVER', events: [{ fixed: '1.2.3' }] }],
              package: { name: 'lodash', ecosystem: 'npm' },
            },
          ],
        },
      ]);

      await vulnerabilities.fetchVulnerabilities(config, packageFiles);

      expect(config.packageRules).toHaveLength(1);
    });
  });
});
