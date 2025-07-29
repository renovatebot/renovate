import * as _merge from '../init/merge';
import { getReconfigureBranchName, getReconfigureConfig } from './utils';
import { fs, logger } from '~test/util';

vi.mock('../../../util/fs');
vi.mock('../init/merge');

const merge = vi.mocked(_merge);
const reconfigureBranch = 'renovate/reconfigure';

describe('workers/repository/reconfigure/utils', () => {
  describe('getReconfigureConfig()', () => {
    beforeEach(() => {
      merge.detectConfigFile.mockResolvedValue('renovate.json');
    });

    it('no config file found', async () => {
      merge.detectConfigFile.mockResolvedValue(null);
      const res = await getReconfigureConfig(reconfigureBranch);
      expect(res).toMatchObject({
        ok: false,
        errMessage: 'Validation Failed - No config file found',
      });
    });

    it('handles error while reading reconfigure config file', async () => {
      fs.readLocalFile.mockResolvedValue(null);
      const res = await getReconfigureConfig(reconfigureBranch);
      expect(res).toMatchObject({
        ok: false,
        errMessage: 'Validation Failed - Invalid config file',
        configFileName: 'renovate.json',
      });
    });

    it('handles invalid reconfigure config', async () => {
      fs.readLocalFile.mockResolvedValue('{');
      const res = await getReconfigureConfig(reconfigureBranch);
      expect(res).toMatchObject({
        ok: false,
        errMessage: 'Validation Failed - Unparsable config file',
        configFileName: 'renovate.json',
      });
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { err: expect.any(Object) },
        'Error while parsing config file',
      );
    });

    it('return config', async () => {
      merge.detectConfigFile.mockResolvedValue('package.json'); // using package.json for coverage
      fs.readLocalFile.mockResolvedValue('{renovate: {}}');
      const res = await getReconfigureConfig(reconfigureBranch);
      expect(res).toMatchObject({
        ok: true,
        config: {},
        configFileName: 'package.json',
      });
    });
  });

  describe('getReconfigureBranchName()', () => {
    it('returns reconfigure branch name', () => {
      expect(getReconfigureBranchName('renovate/')).toBe(
        'renovate/reconfigure',
      );
      expect(getReconfigureBranchName('prefix/')).toBe('prefix/reconfigure');
    });
  });
});
