import { matchRegexOrGlobList } from '../../../util/string-match.ts';
import { defaultConfig } from './index.ts';

describe('modules/manager/nuget/index', () => {
  describe('managerFilePatterns', () => {
    const paths = [
      'src/Project.csproj',
      'src/Project.fsproj',
      'src/Project.vbproj',
      'src/Database.sqlproj',
      'Directory.Build.props',
      'Directory.Build.targets',
      'global.json',
      '.config/dotnet-tools.json',
    ];

    it.each(paths)('matches %s', (path) => {
      expect(
        matchRegexOrGlobList(path, defaultConfig.managerFilePatterns),
      ).toBe(true);
    });

    it('does not match unrelated files', () => {
      expect(
        matchRegexOrGlobList('package.json', defaultConfig.managerFilePatterns),
      ).toBe(false);
    });
  });

  describe('defaultConfig', () => {
    it('bumps msbuild-sdk dependencies via package rule', () => {
      expect(defaultConfig.packageRules).toEqual([
        {
          matchDepTypes: ['msbuild-sdk'],
          rangeStrategy: 'bump',
        },
      ]);
    });
  });
});
