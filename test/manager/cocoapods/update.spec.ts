import fs from 'fs-extra';
import path from 'path';
import { updateDependency } from '../../../lib/manager/cocoapods';

const simplePodfile = fs.readFileSync(
  path.resolve(__dirname, './_fixtures/Podfile.simple'),
  'utf-8'
);

describe('lib/manager/cocoapods/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depName: 'b',
        managerData: { lineNumber: 4 },
        currentValue: '1.2.3',
        newValue: '2.0.0',
      };
      const res = updateDependency(simplePodfile, upgrade);
      expect(res).not.toEqual(simplePodfile);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('returns same content', () => {
      const upgrade = {
        depName: 'b',
        managerData: { lineNumber: 4 },
        currentValue: '1.2.3',
        newValue: '1.2.3',
      };
      const res = updateDependency(simplePodfile, upgrade);
      expect(res).toEqual(simplePodfile);
      expect(res).toBe(simplePodfile);
    });
    it('returns null', () => {
      const upgrade = {
        depName: 'b',
        managerData: { lineNumber: 0 },
        currentValue: '1.2.3',
        newValue: '2.0.0',
      };
      const res = updateDependency(simplePodfile, upgrade);
      expect(res).toBeNull();
    });
  });
});
