import { processSupersedesManagers } from './supersedes';
import type { ExtractResults } from './types';

describe('workers/repository/extract/supersedes', () => {
  describe('processSupersedesManagers', () => {
    it('handles empty input', () => {
      const extractResults: ExtractResults[] = [];
      processSupersedesManagers(extractResults);
      expect(extractResults).toEqual([]);
    });

    it('ignores extracts without superseding managers', () => {
      const extractResults: ExtractResults[] = [
        {
          manager: 'ansible',
          packageFiles: [{ packageFile: 'test.yml', deps: [] }],
        },
      ];
      processSupersedesManagers(extractResults);
      expect(extractResults).toEqual([
        {
          manager: 'ansible',
          packageFiles: [{ packageFile: 'test.yml', deps: [] }],
        },
      ]);
    });

    it('removes superseded package files without lock files', () => {
      const extractResults: ExtractResults[] = [
        {
          manager: 'bun',
          packageFiles: [{ packageFile: 'package.json', deps: [] }],
        },
        {
          manager: 'npm',
          packageFiles: [{ packageFile: 'package.json', deps: [] }],
        },
      ];
      processSupersedesManagers(extractResults);
      expect(extractResults).toEqual([
        {
          manager: 'bun',
          packageFiles: [{ packageFile: 'package.json', deps: [] }],
        },
        {
          manager: 'npm',
          packageFiles: [],
        },
      ]);
    });

    it('keeps superseded package files with lock files', () => {
      const extractResults: ExtractResults[] = [
        {
          manager: 'bun',
          packageFiles: [{ packageFile: 'package.json', deps: [] }],
        },
        {
          manager: 'npm',
          packageFiles: [
            {
              packageFile: 'package.json',
              deps: [],
              lockFiles: ['package-lock.json'],
            },
          ],
        },
      ];
      processSupersedesManagers(extractResults);
      expect(extractResults).toEqual([
        {
          manager: 'bun',
          packageFiles: [],
        },
        {
          manager: 'npm',
          packageFiles: [
            {
              packageFile: 'package.json',
              deps: [],
              lockFiles: ['package-lock.json'],
            },
          ],
        },
      ]);
    });

    it('keeps non-superseded package files', () => {
      const extractResults: ExtractResults[] = [
        {
          manager: 'bun',
          packageFiles: [{ packageFile: 'package.json', deps: [] }],
        },
        {
          manager: 'npm',
          packageFiles: [
            { packageFile: 'package.json', deps: [] },
            { packageFile: 'other/package.json', deps: [] },
          ],
        },
      ];
      processSupersedesManagers(extractResults);
      expect(extractResults).toEqual([
        {
          manager: 'bun',
          packageFiles: [{ packageFile: 'package.json', deps: [] }],
        },
        {
          manager: 'npm',
          packageFiles: [{ packageFile: 'other/package.json', deps: [] }],
        },
      ]);
    });

    it('handles primary extract with undefined packageFiles', () => {
      const extractResults: ExtractResults[] = [
        {
          manager: 'bun',
        },
        {
          manager: 'npm',
          packageFiles: [{ packageFile: 'package.json', deps: [] }],
        },
      ];
      processSupersedesManagers(extractResults);
      expect(extractResults).toEqual([
        {
          manager: 'bun',
        },
        {
          manager: 'npm',
          packageFiles: [{ packageFile: 'package.json', deps: [] }],
        },
      ]);
    });

    it('handles missing secondary extract manager', () => {
      const extractResults: ExtractResults[] = [
        {
          manager: 'bun',
          packageFiles: [{ packageFile: 'package.json', deps: [] }],
        },
      ];
      processSupersedesManagers(extractResults);
      expect(extractResults).toEqual([
        {
          manager: 'bun',
          packageFiles: [{ packageFile: 'package.json', deps: [] }],
        },
      ]);
    });

    it('handles secondary extract with undefined packageFiles', () => {
      const extractResults: ExtractResults[] = [
        {
          manager: 'bun',
          packageFiles: [{ packageFile: 'package.json', deps: [] }],
        },
        {
          manager: 'npm',
        },
      ];
      processSupersedesManagers(extractResults);
      expect(extractResults).toEqual([
        {
          manager: 'bun',
          packageFiles: [{ packageFile: 'package.json', deps: [] }],
        },
        {
          manager: 'npm',
        },
      ]);
    });
  });
});
