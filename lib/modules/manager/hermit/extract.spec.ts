import { mockedFunction } from '../../../../test/util';
import { readLocalDirectory } from '../../../util/fs';
import { HermitDatasource } from '../../datasource/hermit';
import { extractPackageFile } from './extract';

jest.mock('../../../util/fs');

const readdirMock = mockedFunction(readLocalDirectory);

describe('modules/manager/hermit/extract', () => {
  describe('extractPackageFile', () => {
    it('should list packages on command success', async () => {
      const ret = [
        '.go-1.17.9.pkg',
        'go',
        '.golangci-lint-1.40.0.pkg',
        'golangci-lint',
        '.jq@stable.pkg',
        'jq',
        '.somepackage-invalid-version.pkg',
      ];
      readdirMock.mockResolvedValue(ret);

      const rootPackages = await extractPackageFile('', 'bin/hermit');
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

      const nestedRet = [
        '.gradle-7.4.2.pkg',
        'go',
        '.openjdk-11.0.11_9-zulu11.48.21.pkg',
        'java',
        '.maven@3.8.pkg',
        'maven',
      ];
      readdirMock.mockResolvedValue(nestedRet);
      const nestedPackages = await extractPackageFile('', 'nested/bin/hermit');
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

    it('should throw error on execution failure', async () => {
      const msg = 'error reading directory';
      readdirMock.mockRejectedValue(new Error(msg));

      expect(await extractPackageFile('', 'bin/hermit')).toBeNull();
    });
  });
});
