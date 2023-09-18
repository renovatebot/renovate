import { processSupersedesManagers } from './supersedes';
import type { ExtractResults } from './types';

describe('workers/repository/extract/supersedes', () => {
  describe('processSupercedesManagers', () => {
    it('handles empty extractResults', () => {
      const extractResults: ExtractResults[] = [];
      processSupersedesManagers(extractResults);
      expect(extractResults).toHaveLength(0);
    });

    it('handles supercedes subset', () => {
      const extractResults: ExtractResults[] = [
        { manager: 'ansible' },
        {
          manager: 'bun',
          packageFiles: [{ packageFile: 'package.json', deps: [] }],
        },
        {
          manager: 'npm',
          packageFiles: [
            { packageFile: 'package.json', deps: [] },
            { packageFile: 'backend/package.json', deps: [] },
          ],
        },
      ];
      processSupersedesManagers(extractResults);
      expect(extractResults).toMatchObject([
        { manager: 'ansible' },
        {
          manager: 'bun',
          packageFiles: [
            {
              deps: [],
              packageFile: 'package.json',
            },
          ],
        },
        {
          manager: 'npm',
          packageFiles: [{ deps: [], packageFile: 'backend/package.json' }],
        },
      ]);
    });
  });
});
