import { getConfig } from '../../../config/defaults';
import { PuppetForgeDatasource } from '../../../modules/datasource/puppet-forge';
import type { PackageFile } from '../../../modules/manager/types';
import { fetchUpdates } from './fetch';
import * as lookup from './lookup';
import type { RenovateConfig } from '~test/util';

const lookupUpdates = vi.mocked(lookup).lookupUpdates;
vi.mock('./lookup');

describe('workers/repository/process/puppet-module-fetch', () => {
  describe('fetchUpdates()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      config = getConfig();
      config.rangeStrategy = 'auto';
    });

    it('processes puppet-module dependencies including skipReason', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        'puppet-module': [
          {
            packageFile: 'metadata.json',
            deps: [
              {
                depName: 'puppetlabs/stdlib',
                packageName: 'puppetlabs/stdlib',
                currentValue: '>= 9.0.0 < 10.0.0',
                datasource: PuppetForgeDatasource.id,
              },
              {
                depName: 'puppetlabs/other',
                packageName: 'puppetlabs/other',
                skipReason: 'unspecified-version',
                datasource: PuppetForgeDatasource.id,
              },
            ],
          },
        ],
      };
      lookupUpdates.mockResolvedValueOnce({
        updates: [{ newValue: '>= 9.0.0 < 11.0.0' }],
      } as never);
      await fetchUpdates(config, packageFiles);
      expect(packageFiles['puppet-module'][0].deps[0]).toMatchObject({
        depName: 'puppetlabs/stdlib',
        updates: [{ newValue: '>= 9.0.0 < 11.0.0' }],
      });
      expect(packageFiles['puppet-module'][0].deps[1]).toMatchObject({
        depName: 'puppetlabs/other',
        skipReason: 'unspecified-version',
        updates: [],
      });
    });
  });
});
