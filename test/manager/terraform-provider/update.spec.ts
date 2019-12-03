import { readFileSync } from 'fs';
import { updateDependency } from '../../../lib/manager/terraform-provider/update';

const tf1 = readFileSync(
  'test/datasource/terraform-provider/_fixtures/1.tf',
  'utf8'
);

describe('manager/terraform/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depType: 'terraform',
        depName: 'azurerm',
        managerData: { lineNumber: 2 },
        depNameShort: 'azurerm',
        newValue: '=1.37.0',
      };
      const res = updateDependency(tf1, upgrade);
      expect(res).not.toEqual(tf1);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        depType: 'terraform',
        depName: 'gitlab',
        managerData: { lineNumber: 7 },
        depNameShort: 'gitlab',
        newValue: '=2.4',
      };
      const res = updateDependency(tf1, upgrade);
      expect(res).toEqual(tf1);
    });
    it('returns null if wrong line', () => {
      const upgrade = {
        depType: 'terraform',
        depName: 'gitlab',
        managerData: { lineNumber: 11 },
        depNameShort: 'gitlab',
        newValue: '1.0.0',
      };
      const res = updateDependency(tf1, upgrade);
      expect(res).toBeNull();
    });
  });
});
