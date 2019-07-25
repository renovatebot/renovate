import { readFileSync } from 'fs';
import { updateDependency } from '../../../lib/manager/nuget/update';

const csProj = readFileSync(
  'test/datasource/nuget/_fixtures/sample.csproj',
  'utf8'
);

describe('manager/nuget/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        managerData: { lineNumber: 13 },
        newVersion: '5.0.0',
      };
      const res = updateDependency(csProj, upgrade);
      expect(res).not.toEqual(csProj);
    });
    it('keeps intact when same version', () => {
      const upgrade = {
        managerData: { lineNumber: 13 },
        newVersion: '4.1.0',
      };
      const res = updateDependency(csProj, upgrade);
      expect(res).toEqual(csProj);
    });
    it('returns null on errors', () => {
      const res = updateDependency(csProj, null);
      expect(res).toBeNull();
    });
  });
});
