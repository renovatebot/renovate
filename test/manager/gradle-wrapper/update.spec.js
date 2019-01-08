const fs = require('fs');
const got = require('got');
const dcUpdate = require('../../../lib/manager/gradle-wrapper/update');

jest.mock('got');

const propertiesFile1 = fs.readFileSync(
  'test/_fixtures/gradle-wrapper/gradle-wrapper-1.properties',
  'utf8'
);
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
      expect(res.includes(upgrade.downloadUrl.replace(':', '\\:'))).toBe(true);
      expect(res.includes(checksum)).toBe(true);
    });

    it('replaces existing value and add digest', async () => {
      const upgrade = {
        gradleWrapperType: 'bin',
        toVersion: '5.0.0',
        version: '5.0.0',
        lineNumber: 4,
        downloadUrl:
          'https://services.gradle.org/distributions/gradle-5.0-bin.zip',
        checksumUrl:
          'https://services.gradle.org/distributions/gradle-5.0-bin.zip.sha256',
      };
      const checksum =
        '6157ac9f3410bc63644625b3b3e9e96c963afd7910ae0697792db57813ee79a6';
      got.mockReturnValueOnce({
        body: checksum,
      });
      const res = await dcUpdate.updateDependency(propertiesFile1, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).not.toEqual(propertiesFile1);
      expect(res.includes(upgrade.downloadUrl.replace(':', '\\:'))).toBe(true);
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
