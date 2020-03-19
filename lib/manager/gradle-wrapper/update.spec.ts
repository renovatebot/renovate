import fs, { readFileSync } from 'fs';
import { resolve } from 'path';
import * as dcUpdate from '.';
import _got from '../../util/got';

jest.mock('../../util/got');

const got: jest.Mock<any> = _got as any;

const propertiesFile2 = fs.readFileSync(
  'lib/manager/gradle-wrapper/__fixtures__/gradle-wrapper-2.properties',
  'utf8'
);
const whitespacePropertiesFile = readFileSync(
  resolve(__dirname, './__fixtures__/gradle-wrapper-whitespace.properties'),
  'utf8'
);

const testUpgrades = {
  5: {
    data: {
      toVersion: '5.0.0',
      version: '5.0.0',
      managerData: {
        gradleWrapperType: 'all',
        lineNumber: 5,
        checksumLineNumber: 6,
      },
      downloadUrl:
        'https://services.gradle.org/distributions/gradle-5.0-bin.zip',
      checksumUrl:
        'https://services.gradle.org/distributions/gradle-5.0-bin.zip.sha256',
    },
    checksum:
      '17847c8e12b2bcfce26a79f425f082c31d4ded822f99a66127eee2d96bf18216',
  },
  4: {
    data: {
      toVersion: '4.10.3',
      version: '4.10.3',
      managerData: {
        lineNumber: 5,
        checksumLineNumber: 6,
      },
      downloadUrl:
        'https://services.gradle.org/distributions/gradle-4.10.3-all.zip',
      checksumUrl:
        'https://services.gradle.org/distributions/gradle-4.10.3-all.zip.sha256',
    },
    checksum:
      '336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043',
  },
};

describe('manager/gradle-wrapper/update', () => {
  describe('updateDependency', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('replaces existing value', async () => {
      got.mockReturnValueOnce({
        body: testUpgrades[5].checksum,
      });
      const res = await dcUpdate.updateDependency({
        fileContent: propertiesFile2,
        upgrade: testUpgrades[5].data,
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).not.toEqual(propertiesFile2);
      expect(res).toMatch(
        'https\\://services.gradle.org/distributions/gradle-5.0-all.zip'
      );
      expect(res).toMatch(testUpgrades[5].checksum);
    });

    it('replaces in property files with whitespace', async () => {
      got.mockReturnValueOnce({
        body: testUpgrades[5].checksum,
      });
      const res = await dcUpdate.updateDependency({
        fileContent: whitespacePropertiesFile,
        upgrade: testUpgrades[5].data,
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).not.toEqual(whitespacePropertiesFile);
      expect(res).toMatch(
        'https\\://services.gradle.org/distributions/gradle-5.0-all.zip'
      );
      expect(res).toMatch(testUpgrades[5].checksum);
    });

    it('returns same', async () => {
      got.mockReturnValueOnce({
        body: testUpgrades[4].checksum,
      });
      const res = await dcUpdate.updateDependency({
        fileContent: propertiesFile2,
        upgrade: testUpgrades[4].data,
      });
      expect(res).toEqual(propertiesFile2);
    });

    it('returns null for 404 on checksum', async () => {
      got.mockRejectedValueOnce({
        statusCode: 404,
      });
      const res = await dcUpdate.updateDependency({
        fileContent: propertiesFile2,
        upgrade: testUpgrades[4].data,
      });
      expect(res).toBeNull();
    });

    it('returns null for unknown error on checksum', async () => {
      got.mockRejectedValueOnce(new Error());
      const res = await dcUpdate.updateDependency({
        fileContent: propertiesFile2,
        upgrade: testUpgrades[4].data,
      });
      expect(res).toBeNull();
    });

    it('returns null if error', async () => {
      const res = await dcUpdate.updateDependency({
        fileContent: null,
        upgrade: null,
      });
      expect(res).toBeNull();
    });
  });
});
