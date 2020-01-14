import { readFileSync } from 'fs';
import { resolve } from 'path';

import { updateDependency } from './update';

const droneYAML = readFileSync(
  resolve('lib/manager/droneci/__fixtures__/.drone.yml'),
  'utf8'
);

describe('manager/droneci/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const updateOptions = {
        managerData: { lineNumber: 16 },
        depType: 'docker',
        depName: 'node',
        newValue: '10.16.0',
        newDigest: 'sha256:new-node-hash',
      };
      const res = updateDependency({ fileContent: droneYAML, updateOptions });
      expect(res).not.toEqual(droneYAML);
      expect(res.includes(updateOptions.newDigest)).toBe(true);
    });

    it('returns same', () => {
      const updateOptions = {
        managerData: { lineNumber: 28 },
        depType: 'docker',
        depName: 'redis:alpine',
      };
      const res = updateDependency({ fileContent: droneYAML, updateOptions });
      expect(res).toEqual(droneYAML);
    });

    it('returns null if mismatch', () => {
      const updateOptions = {
        managerData: { lineNumber: 17 },
        depType: 'docker',
        depName: 'postgres',
        newValue: '9.6.8',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = updateDependency({ fileContent: droneYAML, updateOptions });
      expect(res).toBeNull();
    });

    it('returns null if error', () => {
      const res = updateDependency({ fileContent: null, updateOptions: null });
      expect(res).toBeNull();
    });

    it('returns null for unknown depType', () => {
      const updateOptions = {
        currentValue: '4.1.0',
        depName: 'release-workflows',
        managerData: { lineNumber: 3 },
        newValue: '4.2.0',
      };
      const res = updateDependency({ fileContent: droneYAML, updateOptions });
      expect(res).toBeNull();
    });
  });
});
