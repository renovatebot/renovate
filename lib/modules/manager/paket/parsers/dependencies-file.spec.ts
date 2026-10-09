import { codeBlock } from 'common-tags';
import { parse } from './dependencies-file.ts';

describe('modules/manager/paket/parsers/dependencies-file', () => {
  describe('parse()', () => {
    it('should return all packages on main group', () => {
      const result = parse(codeBlock`
        source https://api.nuget.org/v3/index.json

        framework: net8.0

        nuget Fsharp.Core
        nuget xunit > 3 prerelease
      `);

      expect(result).toEqual({
        groups: [
          {
            groupName: 'Main',
            sources: ['https://api.nuget.org/v3/index.json'],
            nugetPackages: [
              { name: 'Fsharp.Core' },
              { name: 'xunit', versionConstraint: '> 3' },
            ],
          },
        ],
      });
    });

    it('should extract sources per group', () => {
      const result = parse(codeBlock`
        source https://api.nuget.org/v3/index.json
        source https://example.com/feed/v3/index.json username: "user" password: "pass"

        nuget Fsharp.Core

        group GroupA
          nuget Fake
      `);

      expect(result).toEqual({
        groups: [
          {
            groupName: 'Main',
            sources: [
              'https://api.nuget.org/v3/index.json',
              'https://example.com/feed/v3/index.json',
            ],
            nugetPackages: [{ name: 'Fsharp.Core' }],
          },
          {
            groupName: 'GroupA',
            sources: [],
            nugetPackages: [{ name: 'Fake' }],
          },
        ],
      });
    });

    it('should extract version constraints', () => {
      const result = parse(codeBlock`
        source https://api.nuget.org/v3/index.json

        nuget PinnedPackage 1.2.3
        nuget PinnedWithEqual = 1.2.3
        nuget PinnedPrerelease 1.2.3-alpha001
        nuget ExactPackage == 1.2.3 // Take exactly this version.
        nuget AtLeastPackage >= 1.2.3
        nuget RangePackage >= 1.2.3 < 1.5
        nuget PessimisticPackage ~> 1.2.3
        nuget CompoundPackage ~> 1.2 >= 1.2.3
        nuget MinStrategyPackage !~> 1.2
        nuget MaxStrategyPackage @~> 1.2
        nuget MaxGreaterPackage @> 0
        nuget MinEqualPackage != 1.2
        nuget ConstraintWithOptions >= 1.2.3 prerelease strategy: min
        nuget OptionsOnlyPackage redirects: on
      `);

      expect(result).toEqual({
        groups: [
          {
            groupName: 'Main',
            sources: ['https://api.nuget.org/v3/index.json'],
            nugetPackages: [
              { name: 'PinnedPackage', versionConstraint: '1.2.3' },
              { name: 'PinnedWithEqual', versionConstraint: '= 1.2.3' },
              {
                name: 'PinnedPrerelease',
                versionConstraint: '1.2.3-alpha001',
              },
              { name: 'ExactPackage', versionConstraint: '== 1.2.3' },
              { name: 'AtLeastPackage', versionConstraint: '>= 1.2.3' },
              { name: 'RangePackage', versionConstraint: '>= 1.2.3 < 1.5' },
              { name: 'PessimisticPackage', versionConstraint: '~> 1.2.3' },
              {
                name: 'CompoundPackage',
                versionConstraint: '~> 1.2 >= 1.2.3',
              },
              { name: 'MinStrategyPackage', versionConstraint: '!~> 1.2' },
              { name: 'MaxStrategyPackage', versionConstraint: '@~> 1.2' },
              { name: 'MaxGreaterPackage', versionConstraint: '@> 0' },
              { name: 'MinEqualPackage', versionConstraint: '!= 1.2' },
              { name: 'ConstraintWithOptions', versionConstraint: '>= 1.2.3' },
              { name: 'OptionsOnlyPackage' },
            ],
          },
        ],
      });
    });

    it('should return all groups', () => {
      const result = parse(codeBlock`
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
            sources: ['https://api.nuget.org/v3/index.json'],
            nugetPackages: [{ name: 'Fsharp.Core' }],
          },
          {
            groupName: 'GroupA',
            sources: ['https://api.nuget.org/v3/index.json'],
            nugetPackages: [{ name: 'Fake' }],
          },
          {
            groupName: 'GroupB',
            sources: ['https://api.nuget.org/v3/index.json'],
            nugetPackages: [{ name: 'Fsharp.Core' }, { name: 'xunit' }],
          },
        ],
      });
    });
  });
});
