import { Dependency, parse } from './lock-file';

describe('modules/manager/paket/parsers/lock-file', () => {
  describe('parse()', () => {
    it('should return all nuget package version on main group', () => {
      const result = parse(`
RESTRICTION: == net8.0
NUGET
  remote: https://api.nuget.org/v3/index.json
    dotnet-fable (2.0.11) - clitool: true
      Dotnet.ProjInfo (>= 0.20)
      FSharp.Core (>= 4.5.2)
    Dotnet.ProjInfo (0.44)
      FSharp.Core (>= 4.6.2)
`);

      expect(result).toEqual<Dependency[]>([
        {
          groupName: 'Main',
          source: 'nuget',
          remote: 'https://api.nuget.org/v3/index.json',
          packageName: 'dotnet-fable',
          version: '2.0.11',
        },
        {
          groupName: 'Main',
          source: 'nuget',
          remote: 'https://api.nuget.org/v3/index.json',
          packageName: 'Dotnet.ProjInfo',
          version: '0.44',
        },
      ]);
    });

    it('should return all nuget sources on main group', () => {
      const result = parse(`
RESTRICTION: == net8.0
NUGET
  remote: https://api.nuget.org/v3/index.json
    dotnet-fable (2.0.11) - clitool: true
      Dotnet.ProjInfo (>= 0.20)
      FSharp.Core (>= 4.5.2)
  remote: https://example.com/v3/index.json
    FSharp.Core (9.0.300)
`);

      expect(result).toEqual<Dependency[]>([
        {
          groupName: 'Main',
          source: 'nuget',
          remote: 'https://api.nuget.org/v3/index.json',
          packageName: 'dotnet-fable',
          version: '2.0.11',
        },
        {
          groupName: 'Main',
          source: 'nuget',
          remote: 'https://example.com/v3/index.json',
          packageName: 'FSharp.Core',
          version: '9.0.300',
        },
      ]);
    });

    it('should return all nuget sources of all groups', () => {
      const result = parse(`
RESTRICTION: == net8.0
NUGET
  remote: https://api.nuget.org/v3/index.json
    FSharp.Core (9.0.300)
GROUP GroupA
NUGET
  remote: https://api.nuget.org/v3/index.json
    FAKE (5.16)
GITHUB
  remote: forki/FsUnit
    FsUnit.fs (fa4eb37288d355eb855261be6c0b3945fba68432)
GROUP GroupB
NUGET
  remote: https://api.nuget.org/v3/index.json
    dotnet-fable (2.0.11) - clitool: true
      Dotnet.ProjInfo (>= 0.20)
      FSharp.Core (>= 4.5.2)
  remote: https://example.com/v3/index.json
    FSharp.Core (9.0.300)
`);

      expect(result).toEqual<Dependency[]>([
        {
          groupName: 'Main',
          source: 'nuget',
          remote: 'https://api.nuget.org/v3/index.json',
          packageName: 'FSharp.Core',
          version: '9.0.300',
        },
        {
          groupName: 'GroupA',
          source: 'nuget',
          remote: 'https://api.nuget.org/v3/index.json',
          packageName: 'FAKE',
          version: '5.16',
        },
        {
          groupName: 'GroupB',
          source: 'nuget',
          remote: 'https://api.nuget.org/v3/index.json',
          packageName: 'dotnet-fable',
          version: '2.0.11',
        },
        {
          groupName: 'GroupB',
          source: 'nuget',
          remote: 'https://example.com/v3/index.json',
          packageName: 'FSharp.Core',
          version: '9.0.300',
        },
      ]);
    });
  });
});
