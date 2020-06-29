import { getConfig, mocked } from '../../../../test/util';
import { RenovateConfig } from '../../../config';
import * as _html from '../../../manager/html';
import * as _gitfs from '../../../util/gitfs';
import * as _fileMatch from './file-match';
import { getManagerPackageFiles } from './manager-files';

jest.mock('./file-match');
jest.mock('../../../manager/html');
jest.mock('../../../util/gitfs');

const gitfs: any = _gitfs;
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
      fileMatch.getMatchingFiles.mockResolvedValue(['package.json']);
      const res = await getManagerPackageFiles(managerConfig);
      expect(res).toHaveLength(0);
    });
    it('returns files with extractPackageFile', async () => {
      const managerConfig = {
        manager: 'html',
        enabled: true,
        fileList: ['Dockerfile'],
      };
      fileMatch.getMatchingFiles.mockResolvedValue(['Dockerfile']);
      gitfs.readLocalFile.mockResolvedValueOnce('some content');
      html.extractPackageFile = jest.fn(() => ({
        deps: [{}, { replaceString: 'abc' }],
      })) as never;
      const res = await getManagerPackageFiles(managerConfig);
      expect(res).toMatchSnapshot();
    });
    it('returns files with extractAllPackageFiles', async () => {
      const managerConfig = {
        manager: 'npm',
        enabled: true,
        fileList: ['package.json'],
      };
      fileMatch.getMatchingFiles.mockResolvedValue(['package.json']);
      gitfs.readLocalFile.mockResolvedValueOnce(
        '{"dependencies":{"chalk":"2.0.0"}}'
      );
      const res = await getManagerPackageFiles(managerConfig);
      expect(res).toMatchSnapshot();
    });
  });
});
