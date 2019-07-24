const fs = require('fs');
const { updateDependency } = require('../../../lib/manager/droneci/update');

const droneYAML = fs.readFileSync(
  'test/manager/droneci/_fixtures/.drone.yml',
  'utf8'
);

describe('manager/droneci/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        managerData: { lineNumber: 16 },
        depType: 'docker',
        depName: 'node',
        newValue: '10.16.0',
        newDigest: 'sha256:new-node-hash',
      };
      const res = updateDependency(droneYAML, upgrade);
      expect(res).not.toEqual(droneYAML);
      expect(res.includes(upgrade.newDigest)).toBe(true);
    });

    it('returns same', () => {
      const upgrade = {
        managerData: { lineNumber: 28 },
        depType: 'docker',
        depName: 'redis:alpine',
      };
      const res = updateDependency(droneYAML, upgrade);
      expect(res).toEqual(droneYAML);
    });

    it('returns null if mismatch', () => {
      const upgrade = {
        managerData: { lineNumber: 17 },
        depType: 'docker',
        depName: 'postgres',
        newValue: '9.6.8',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = updateDependency(droneYAML, upgrade);
      expect(res).toBeNull();
    });

    it('returns null if error', () => {
      const res = updateDependency(null, null);
      expect(res).toBeNull();
    });

    it('returns null for unknown depType', () => {
      const upgrade = {
        currentValue: '4.1.0',
        depName: 'release-workflows',
        managerData: { lineNumber: 3 },
        newValue: '4.2.0',
      };
      const res = updateDependency(droneYAML, upgrade);
      expect(res).toBeNull();
    });
  });
});
