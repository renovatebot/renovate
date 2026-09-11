import { processSupersedesManagers } from './supersedes.ts';
import type { ExtractResults } from './types.ts';

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

    it('keeps the secondary when the primary says it cannot update the file', () => {
      // The primary states this rather than it being inferred from its
      // dependencies: a manager whose extractors disagree about one dependency
      // can report an entry whose every dependency is skipped and mean the
      // opposite -- do not update this.
      const extractResults: ExtractResults[] = [
        {
          manager: 'bun',
          packageFiles: [
            {
              packageFile: 'package.json',
              cannotUpdate: true,
              deps: [{ depName: 'lodash', skipReason: 'unsupported' }],
            },
          ],
        },
        {
          manager: 'npm',
          packageFiles: [
            { packageFile: 'package.json', deps: [{ depName: 'lodash' }] },
          ],
        },
      ];
      processSupersedesManagers(extractResults);
      expect(extractResults[1].packageFiles).toEqual([
        { packageFile: 'package.json', deps: [{ depName: 'lodash' }] },
      ]);
      // The primary keeps its own entry too. Asserting only the secondary lets
      // an implementation pass that drops the primary instead -- the file would
      // still be maintained by one manager, but by neither the one that claimed
      // it nor for the reason this test is about.
      expect(extractResults[0].packageFiles).toHaveLength(1);
    });

    it('still supersedes an entry whose dependencies are skipped but says nothing', () => {
      // Skipped dependencies alone change nothing: a manager may skip a
      // dependency because it must not be updated, which is the opposite of
      // being unable to update it.
      const extractResults: ExtractResults[] = [
        {
          manager: 'bun',
          packageFiles: [
            {
              packageFile: 'package.json',
              deps: [{ depName: 'lodash', skipReason: 'unsupported' }],
            },
          ],
        },
        {
          manager: 'npm',
          packageFiles: [
            { packageFile: 'package.json', deps: [{ depName: 'lodash' }] },
          ],
        },
      ];
      processSupersedesManagers(extractResults);
      expect(extractResults[1].packageFiles).toEqual([]);
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
