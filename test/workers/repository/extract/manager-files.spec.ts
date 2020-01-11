import { getManagerPackageFiles } from '../../../../lib/workers/repository/extract/manager-files';
import * as _fileMatch from '../../../../lib/workers/repository/extract/file-match';
import * as _dockerfile from '../../../../lib/manager/dockerfile';
import { mocked, platform, getConfig } from '../../../util';
import { RenovateConfig } from '../../../../lib/config';

jest.mock('../../../../lib/workers/repository/extract/file-match');
jest.mock('../../../../lib/manager/dockerfile');

const fileMatch = mocked(_fileMatch);
const dockerfile = mocked(_dockerfile);

describe('workers/repository/extract/manager-files', () => {
  describe('getManagerPackageFiles()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      config = getConfig;
    });
    it('returns empty of manager is disabled', async () => {
      const managerConfig = { manager: 'travis', enabled: false };
      const res = await getManagerPackageFiles(managerConfig);
      expect(res).toHaveLength(0);
    });
    it('returns empty of manager is not enabled', async () => {
      config.enabledManagers = ['npm'];
      const managerConfig = { manager: 'docker', enabled: true };
      const res = await getManagerPackageFiles(managerConfig);
      expect(res).toHaveLength(0);
    });
    it('skips files if null content returned', async () => {
      const managerConfig = { manager: 'npm', enabled: true };
      fileMatch.getMatchingFiles.mockReturnValue(['package.json']);
      const res = await getManagerPackageFiles(managerConfig);
      expect(res).toHaveLength(0);
    });
    it('returns files with extractPackageFile', async () => {
      const managerConfig = { manager: 'dockerfile', enabled: true };
      fileMatch.getMatchingFiles.mockReturnValue(['Dockerfile']);
      platform.getFile.mockResolvedValue('some content');
      dockerfile.extractPackageFile = jest.fn(() => ({
        some: 'result',
      })) as never;
      const res = await getManagerPackageFiles(managerConfig);
      expect(res).toMatchSnapshot();
    });
    it('returns files with extractAllPackageFiles', async () => {
      const managerConfig = { manager: 'npm', enabled: true };
      fileMatch.getMatchingFiles.mockReturnValue(['package.json']);
      platform.getFile.mockResolvedValue('{}');
      const res = await getManagerPackageFiles(managerConfig);
      expect(res).toMatchSnapshot();
    });
  });
});
