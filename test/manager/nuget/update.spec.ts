import { readFileSync } from 'fs';
import { updateDependency } from '../../../lib/manager/nuget/update';

const csProj = readFileSync(
  'test/datasource/nuget/_fixtures/sample.csproj',
  'utf8'
);

describe('manager/nuget/update', () => {
  describe('updateDependency', () => {
    it('replaces simple value', () => {
      const upgrade = {
        managerData: { lineNumber: 13 },
        newVersion: '5.0.0',
      };
      const res = updateDependency(csProj, upgrade);
      expect(res).not.toEqual(csProj);
    });
    it('replaces left boundary value', () => {
      let res = csProj;
      for (let i = 24; i <= 26; i += 1) {
        const upgrade = {
          managerData: { lineNumber: i },
          newVersion: i + '.2.1',
        };
        res = updateDependency(res, upgrade);
      }
      expect(res).toMatchSnapshot();
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
