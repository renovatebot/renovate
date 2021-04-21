import { fs, getConfig, getName, mocked } from '../../../../test/util';
import type { RenovateConfig } from '../../../config/types';
import * as _html from '../../../manager/html';
import * as _fileMatch from './file-match';
import { getManagerPackageFiles } from './manager-files';

jest.mock('./file-match');
jest.mock('../../../manager/html');
jest.mock('../../../util/fs');

const fileMatch = mocked(_fileMatch);
const html = mocked(_html);

describe(getName(__filename), () => {
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
      const managerConfig = {
        manager: 'html',
        enabled: true,
        fileList: ['Dockerfile'],
      };
      fileMatch.getMatchingFiles.mockReturnValue(['Dockerfile']);
      fs.readLocalFile.mockResolvedValueOnce('some content');
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
      fileMatch.getMatchingFiles.mockReturnValue(['package.json']);
      fs.readLocalFile.mockResolvedValueOnce(
        '{"dependencies":{"chalk":"2.0.0"}}'
      );
      const res = await getManagerPackageFiles(managerConfig);
      expect(res).toMatchSnapshot();
    });
  });
});
