import fs from 'fs-extra';
import path from 'path';
import { updateDependency } from '.';

const fileContent = fs.readFileSync(
  path.resolve(__dirname, './__fixtures__/Podfile.simple'),
  'utf-8'
);

describe('lib/manager/cocoapods/update', () => {
  describe('updateDependency', () => {
    it('handles undefined lines', () => {
      const upgrade = {
        depName: 'b',
        managerData: { lineNumber: 999999999 },
        currentValue: '1.2.3',
        newValue: '2.0.0',
      };
      const res = updateDependency({ fileContent, upgrade });
      expect(res).toBeNull();
    });
    it('replaces existing value', () => {
      const upgrade = {
        depName: 'b',
        managerData: { lineNumber: 4 },
        currentValue: '1.2.3',
        newValue: '2.0.0',
      };
      const res = updateDependency({ fileContent, upgrade });
      expect(res).not.toEqual(fileContent);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('returns same content', () => {
      const upgrade = {
        depName: 'b',
        managerData: { lineNumber: 4 },
        currentValue: '1.2.3',
        newValue: '1.2.3',
      };
      const res = updateDependency({ fileContent, upgrade });
      expect(res).toEqual(fileContent);
      expect(res).toBe(fileContent);
    });
    it('returns null', () => {
      const upgrade = {
        depName: 'b',
        managerData: { lineNumber: 0 },
        currentValue: '1.2.3',
        newValue: '2.0.0',
      };
      const res = updateDependency({ fileContent, upgrade });
      expect(res).toBeNull();
    });
  });
});
