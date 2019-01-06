const fs = require('fs');
const dcUpdate = require('../../../lib/manager/gradle-wrapper/update');

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
    it('replaces existing value', () => {
      const upgrade = {
        toVersion: '5.0.0',
        lineNumber: 5,
        shaLineNumber: 6,
        version: '5.0.0',
        downloadUrl:
          'https://services.gradle.org/distributions/gradle-5.0-all.zip',
        checksum:
          '336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043',
        digests: 'true',
      };
      const res = dcUpdate.updateDependency(propertiesFile2, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(propertiesFile2);
      expect(res.includes(upgrade.downloadUrl.replace(':', '\\:'))).toBe(true);
      expect(res.includes(upgrade.checksum)).toBe(true);
    });

    it('replaces existing value and add digest', () => {
      const upgrade = {
        toVersion: '5.0.0',
        lineNumber: 4,
        version: '5.0.0',
        downloadUrl:
          'https://services.gradle.org/distributions/gradle-5.0-all.zip',
        checksum:
          '336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043',
        digests: 'true',
      };
      const res = dcUpdate.updateDependency(propertiesFile1, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(propertiesFile1);
      expect(res.includes(upgrade.downloadUrl.replace(':', '\\:'))).toBe(true);
      expect(res.includes(upgrade.checksum)).toBe(true);
    });

    it('replaces existing value and remove digest', () => {
      const upgrade = {
        toVersion: '4.10.3',
        lineNumber: 5,
        shaLineNumber: 6,
        version: '4.10.3',
        downloadUrl:
          'https://services.gradle.org/distributions/gradle-4.10.3-all.zip',
        digests: 'false',
      };
      const res = dcUpdate.updateDependency(propertiesFile2, upgrade);
      expect(res).toMatchSnapshot();
      expect(res.includes(upgrade.downloadUrl.replace(':', '\\:'))).toBe(true);
    });

    it('returns same', () => {
      const upgrade = {
        toVersion: '4.10.3',
        lineNumber: 5,
        shaLineNumber: 6,
        version: '4.10.3',
        downloadUrl:
          'https://services.gradle.org/distributions/gradle-4.10.3-all.zip',
        checksum:
          '336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043',
        digests: 'true',
      };
      const res = dcUpdate.updateDependency(propertiesFile2, upgrade);
      expect(res).toEqual(propertiesFile2);
    });

    it('returns null if error', () => {
      const res = dcUpdate.updateDependency(null, null);
      expect(res).toBe(null);
    });
  });
});
