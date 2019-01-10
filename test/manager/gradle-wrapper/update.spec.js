const fs = require('fs');
const got = require('got');
const dcUpdate = require('../../../lib/manager/gradle-wrapper/update');

jest.mock('got');

const propertiesFile2 = fs.readFileSync(
  'test/_fixtures/gradle-wrapper/gradle-wrapper-2.properties',
  'utf8'
);

describe('manager/gradle-wrapper/update', () => {
  describe('updateDependency', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('replaces existing value', async () => {
      const upgrade = {
        gradleWrapperType: 'all',
        toVersion: '5.0.0',
        version: '5.0.0',
        lineNumber: 5,
        checksumLineNumber: 6,
        downloadUrl:
          'https://services.gradle.org/distributions/gradle-5.0-bin.zip',
        checksumUrl:
          'https://services.gradle.org/distributions/gradle-5.0-bin.zip.sha256',
      };
      const checksum =
        '17847c8e12b2bcfce26a79f425f082c31d4ded822f99a66127eee2d96bf18216';
      got.mockReturnValueOnce({
        body: checksum,
      });
      const res = await dcUpdate.updateDependency(propertiesFile2, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).not.toEqual(propertiesFile2);
      expect(
        res.includes(
          'https\\://services.gradle.org/distributions/gradle-5.0-all.zip'
        )
      ).toBe(true);
      expect(res.includes(checksum)).toBe(true);
    });

    it('returns same', async () => {
      const upgrade = {
        toVersion: '4.10.3',
        version: '4.10.3',
        lineNumber: 5,
        checksumLineNumber: 6,
        downloadUrl:
          'https://services.gradle.org/distributions/gradle-4.10.3-all.zip',
        checksumUrl:
          'https://services.gradle.org/distributions/gradle-4.10.3-all.zip.sha256',
      };
      const checksum =
        '336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043';
      got.mockReturnValueOnce({
        body: checksum,
      });
      const res = await dcUpdate.updateDependency(propertiesFile2, upgrade);
      expect(res).toEqual(propertiesFile2);
    });

    it('returns null for 404 on checksum', async () => {
      const upgrade = {
        toVersion: '4.10.3',
        version: '4.10.3',
        lineNumber: 5,
        checksumLineNumber: 6,
        downloadUrl:
          'https://services.gradle.org/distributions/gradle-4.10.3-all.zip',
        checksumUrl:
          'https://services.gradle.org/distributions/gradle-4.10.3-all.zip.sha256',
      };
      got.mockImplementation(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      const res = await dcUpdate.updateDependency(propertiesFile2, upgrade);
      expect(res).toBeNull();
    });

    it('returns null for unknown error on checksum', async () => {
      const upgrade = {
        toVersion: '4.10.3',
        version: '4.10.3',
        lineNumber: 5,
        checksumLineNumber: 6,
        downloadUrl:
          'https://services.gradle.org/distributions/gradle-4.10.3-all.zip',
        checksumUrl:
          'https://services.gradle.org/distributions/gradle-4.10.3-all.zip.sha256',
      };
      got.mockImplementation(() => {
        throw new Error();
      });
      const res = await dcUpdate.updateDependency(propertiesFile2, upgrade);
      expect(res).toBeNull();
    });

    it('returns null if error', async () => {
      const res = await dcUpdate.updateDependency(null, null);
      expect(res).toBe(null);
    });
  });
});
