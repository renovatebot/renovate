import { getManagerPackageFiles } from '../../../../lib/workers/repository/extract/manager-files';
import * as _fileMatch from '../../../../lib/workers/repository/extract/file-match';
import * as _html from '../../../../lib/manager/html';
import { mocked, platform, getConfig } from '../../../util';
import { RenovateConfig } from '../../../../lib/config';

jest.mock('../../../../lib/workers/repository/extract/file-match');
jest.mock('../../../../lib/manager/html');

const fileMatch = mocked(_fileMatch);
const html = mocked(_html);

describe('workers/repository/extract/manager-files', () => {
  describe('getManagerPackageFiles()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      config = getConfig();
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
      const managerConfig = { manager: 'html', enabled: true };
      fileMatch.getMatchingFiles.mockReturnValue(['Dockerfile']);
      platform.getFile.mockResolvedValue('some content');
      html.extractPackageFile = jest.fn(() => ({
        deps: [{}, { autoReplaceData: { replaceString: 'abc' } }],
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
