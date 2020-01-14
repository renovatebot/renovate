import { readFileSync } from 'fs';
import { updateDependency } from './update';

const csProj = readFileSync(
  'test/datasource/nuget/_fixtures/sample.csproj',
  'utf8'
);

describe('manager/nuget/update', () => {
  describe('updateDependency', () => {
    it('replaces simple value', () => {
      const updateOptions = {
        managerData: { lineNumber: 13 },
        newVersion: '5.0.0',
      };
      const res = updateDependency({ fileContent: csProj, updateOptions });
      expect(res).not.toEqual(csProj);
    });
    it('replaces left boundary value', () => {
      let res = csProj;
      for (let i = 24; i <= 26; i += 1) {
        const updateOptions = {
          managerData: { lineNumber: i },
          newVersion: i + '.2.1',
        };
        res = updateDependency({ fileContent: res, updateOptions });
      }
      expect(res).toMatchSnapshot();
    });
    it('keeps intact when same version', () => {
      const updateOptions = {
        managerData: { lineNumber: 13 },
        newVersion: '4.1.0',
      };
      const res = updateDependency({ fileContent: csProj, updateOptions });
      expect(res).toEqual(csProj);
    });
    it('returns null on errors', () => {
      const res = updateDependency({
        fileContent: csProj,
        updateOptions: null,
      });
      expect(res).toBeNull();
    });
  });
});
