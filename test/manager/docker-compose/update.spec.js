const fs = require('fs');
const dcUpdate = require('../../../lib/manager/docker-compose/update');

const yamlFile = fs.readFileSync(
  'test/_fixtures/docker-compose/docker-compose.1.yml',
  'utf8'
);

describe('manager/docker-compose/update', () => {
  describe('setNewValue', () => {
    it('replaces existing value', () => {
      const upgrade = {
        lineNumber: 18,
        newFrom: 'postgres:9.6.8@sha256:abcdefghijklmnop',
      };
      const res = dcUpdate.setNewValue(yamlFile, upgrade);
      expect(res).not.toEqual(yamlFile);
      expect(res.includes(upgrade.newFrom)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        lineNumber: 4,
        newFrom: 'quay.io/something/redis:alpine',
      };
      const res = dcUpdate.setNewValue(yamlFile, upgrade);
      expect(res).toEqual(yamlFile);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        lineNumber: 17,
        newFrom: 'postgres:9.6.8@sha256:abcdefghijklmnop',
      };
      const res = dcUpdate.setNewValue(yamlFile, upgrade);
      expect(res).toBe(null);
    });
    it('returns null if error', () => {
      const res = dcUpdate.setNewValue(null, null);
      expect(res).toBe(null);
    });
  });
});
