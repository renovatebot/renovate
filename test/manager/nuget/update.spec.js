const fs = require('fs');
const nugetUpdater = require('../../../lib/manager/nuget/update');

const csProj = fs.readFileSync(
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
      const res = nugetUpdater.updateDependency(csProj, upgrade);
      expect(res).not.toEqual(csProj);
    });
    it('keeps intact when same version', () => {
      const upgrade = {
        managerData: { lineNumber: 13 },
        newVersion: '4.1.0',
      };
      const res = nugetUpdater.updateDependency(csProj, upgrade);
      expect(res).toEqual(csProj);
    });
    it('returns null on errors', () => {
      const res = nugetUpdater.updateDependency(csProj, null);
      expect(res).toBeNull();
    });
  });
});
