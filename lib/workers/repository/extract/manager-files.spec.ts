import { fs, getConfig, mocked } from '../../../../test/util';
import type { RenovateConfig } from '../../../config/types';
import * as _html from '../../../modules/manager/html';
import * as _fileMatch from './file-match';
import { getManagerPackageFiles } from './manager-files';

jest.mock('./file-match');
jest.mock('../../../modules/manager/html');
jest.mock('../../../util/fs');

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
      const managerConfig = { manager: 'travis', enabled: false, fileList: [] };
      const res = await getManagerPackageFiles(managerConfig);
      expect(res).toHaveLength(0);
    });

    it('returns empty of manager is not enabled', async () => {
      config.enabledManagers = ['npm'];
      const managerConfig = { manager: 'docker', enabled: true, fileList: [] };
      const res = await getManagerPackageFiles(managerConfig);
      expect(res).toHaveLength(0);
    });

    it('skips files if null content returned', async () => {
      const managerConfig = {
        manager: 'npm',
        fileList: [],
        enabled: true,
      };
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
      expect(res).toEqual([
        {
          packageFile: 'Dockerfile',
          deps: [{ depIndex: 0 }, { depIndex: 1, replaceString: 'abc' }],
        },
      ]);
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
      expect(res).toMatchSnapshot([
        {
          packageFile: 'package.json',
          packageJsonType: 'app',
          deps: [
            {
              currentValue: '2.0.0',
              datasource: 'npm',
              depName: 'chalk',
              depType: 'dependencies',
            },
          ],
        },
      ]);
    });

    it('returns files with regex extractAllPackageFiles', async () => {
      const managerConfig = {
        manager: 'regex',
        enabled: true,
        fileList: ['airbyte.yaml'],
        matchStrings: [
          '# renovate: datasource=(?<datasource>[^\\s]*) depName=(?<depName>[^\\s]+)( versioning=(?<versioning>[^\\s]*))?.*\\n.*: ["]?(?<currentValue>v?[^"\\s]+)["]?\n',
        ],
        versioningTemplate:
          '{{#if versioning}}{{{versioning}}}{{else}}semver{{/if}}',
      };
      fileMatch.getMatchingFiles.mockReturnValue(['airbyte.yaml']);
      fs.readLocalFile.mockResolvedValueOnce(
        '# renovate: datasource=github-releases depName=airbytehq/airbyte versioning=maven\nversion: "0.39.0-alpha"\n'
      );
      const res = await getManagerPackageFiles(managerConfig);
      expect(res).toMatchSnapshot([
        {
          packageFile: 'airbyte.yaml',
          deps: [
            {
              depName: 'airbytehq/airbyte',
              currentValue: '0.39.0-alpha',
              datasource: 'github-releases',
              versioning: 'maven',
              replaceString:
                '# renovate: datasource=github-releases depName=airbytehq/airbyte versioning=maven\n' +
                'version: "0.39.0-alpha"\n',
              depIndex: 0,
            },
          ],
          matchStrings: [
            '# renovate: datasource=(?<datasource>[^\\s]*) depName=(?<depName>[^\\s]+)( versioning=(?<versioning>[^\\s]*))?.*\\n.*: ["]?(?<currentValue>v?[^"\\s]+)["]?\n',
          ],
        },
      ]);
    });
  });
});
