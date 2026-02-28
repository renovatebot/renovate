import { parse } from './dependencies-file.ts';

describe('modules/manager/paket/parsers/dependencies-file', () => {
  describe('parse()', () => {
    it('should return all packages on main group', () => {
      const result = parse(`
source https://api.nuget.org/v3/index.json

framework: net8.0

nuget Fsharp.Core
nuget xunit > 3 prerelease
`);

      expect(result).toEqual({
        groups: [
          {
            groupName: 'Main',
            nugetPackages: [
              { name: 'Fsharp.Core', options: [] },
              { name: 'xunit', options: ['>', '3', 'prerelease'] },
            ],
          },
        ],
      });
    });

    it('should return all groups', () => {
      const result = parse(`
source https://api.nuget.org/v3/index.json

framework: net8.0

nuget Fsharp.Core

group GroupA
  source https://api.nuget.org/v3/index.json
  nuget Fake

group GroupB
  source https://api.nuget.org/v3/index.json

  nuget Fsharp.Core
  nuget xunit
`);

      expect(result).toEqual({
        groups: [
          {
            groupName: 'Main',
            nugetPackages: [{ name: 'Fsharp.Core', options: [] }],
          },
          {
            groupName: 'GroupA',
            nugetPackages: [{ name: 'Fake', options: [] }],
          },
          {
            groupName: 'GroupB',
            nugetPackages: [
              { name: 'Fsharp.Core', options: [] },
              { name: 'xunit', options: [] },
            ],
          },
        ],
      });
    });
  });
});
