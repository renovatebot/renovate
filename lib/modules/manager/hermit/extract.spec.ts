jest.mock('child_process');
jest.mock('../../../util/exec/hermit');
jest.mock('../../../util/fs');
jest.mock('../../../config/global');

import upath from 'upath';
import { mocked, mockedFunction } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import { findHermitCwd } from '../../../util/exec/hermit';
import { readLocalDirectorySync } from '../../../util/fs';
import { HermitDatasource } from '../../datasource/hermit';
import { extractPackageFile } from './extract';

const findHermitCwdMock = mockedFunction(findHermitCwd);
const readdirSyncMock = mockedFunction(readLocalDirectorySync);
const globalConfigMock = mocked(GlobalConfig);

describe('modules/manager/hermit/extract', () => {
  beforeEach(() => {
    findHermitCwdMock.mockClear();
    findHermitCwdMock.mockImplementation((p) => upath.dirname(p));
  });

  describe('extractPackageFile', () => {
    it('should list packages on command success', () => {
      const localDir = '/tmp/renovate/repos/repository-a/';
      globalConfigMock.get.mockReturnValue(localDir);
      const ret = [
        '.go-1.17.9.pkg',
        'go',
        '.golangci-lint-1.40.0.pkg',
        'golangci-lint',
        '.jq@stable.pkg',
        'jq',
        '.somepackage-invalid-version.pkg',
      ];
      readdirSyncMock.mockReturnValue(ret);

      const rootPackages = extractPackageFile('', 'bin/hermit');
      expect(rootPackages).toStrictEqual({
        deps: [
          {
            datasource: HermitDatasource.id,
            depName: 'go',
            currentValue: `1.17.9`,
          },
          {
            datasource: HermitDatasource.id,
            depName: 'golangci-lint',
            currentValue: `1.40.0`,
          },
          {
            datasource: HermitDatasource.id,
            depName: 'jq',
            currentValue: `@stable`,
          },
        ],
      });

      globalConfigMock.get.mockReturnValue(localDir);
      const nestedRet = [
        '.gradle-7.4.2.pkg',
        'go',
        '.openjdk-11.0.11_9-zulu11.48.21.pkg',
        'java',
        '.maven@3.8.pkg',
        'maven',
      ];
      readdirSyncMock.mockReturnValue(nestedRet);
      const nestedPackages = extractPackageFile('', 'nested/bin/hermit');
      expect(nestedPackages).toStrictEqual({
        deps: [
          {
            datasource: HermitDatasource.id,
            depName: 'gradle',
            currentValue: '7.4.2',
          },
          {
            datasource: HermitDatasource.id,
            depName: 'openjdk',
            currentValue: `11.0.11_9-zulu11.48.21`,
          },
          {
            datasource: HermitDatasource.id,
            depName: 'maven',
            currentValue: '@3.8',
          },
        ],
      });
    });

    it('should throw error on execution failure', () => {
      const msg = 'error executing hermit install';
      const localDir = '/tmp/renovate/repos/repository-a/';
      globalConfigMock.get.mockReturnValue(localDir);
      readdirSyncMock.mockImplementation(() => {
        throw new Error(msg);
      });

      expect(extractPackageFile('', 'bin/hermit')).toBeNull();
    });
  });
});
