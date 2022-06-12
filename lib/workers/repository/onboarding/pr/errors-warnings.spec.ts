import { RenovateConfig, getConfig } from '../../../../../test/util';
import type { PackageFile } from '../../../../modules/manager/types';
import {
  getDepWarnings,
  getDepWarningsDashboard,
  getDepWarningsPR,
  getErrors,
  getWarnings,
} from './errors-warnings';

describe('workers/repository/onboarding/pr/errors-warnings', () => {
  describe('getWarnings()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      jest.resetAllMocks();
      config = getConfig();
    });

    it('returns warning text', () => {
      config.warnings = [
        {
          topic: 'foo',
          message: 'Failed to look up dependency',
        },
      ];
      const res = getWarnings(config);
      expect(res).toMatchInlineSnapshot(`
        "
        # Warnings (1)

        Please correct - or verify that you can safely ignore - these warnings before you merge this PR.

        -   \`foo\`: Failed to look up dependency

        ---
        "
      `);
    });
  });

  describe('getDepWarningsPR()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('returns warning text', () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1', topic: undefined }],
              },
              {},
            ],
          },
          {
            packageFile: 'backend/package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1', topic: undefined }],
              },
            ],
          },
        ],
        dockerfile: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                warnings: [{ message: 'Warning 2', topic: undefined }],
              },
            ],
          },
        ],
      };
      const res = getDepWarningsPR(packageFiles);
      expect(res).toMatchInlineSnapshot(`
        "
        ---

        ### ⚠ Dependency Lookup Warnings ⚠

        Please correct - or verify that you can safely ignore - these lookup failures before you merge this PR.

        -   \`Warning 1\`
        -   \`Warning 2\`

        Files affected: \`package.json\`, \`backend/package.json\`, \`Dockerfile\`

        "
      `);
    });
  });

  describe('getDepWarningsDashboard()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('returns warning text', () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1', topic: undefined }],
              },
              {},
            ],
          },
          {
            packageFile: 'backend/package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1', topic: undefined }],
              },
            ],
          },
        ],
        dockerfile: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                warnings: [{ message: 'Warning 2', topic: undefined }],
              },
            ],
          },
        ],
      };
      const res = getDepWarningsDashboard(packageFiles);
      expect(res).toMatchInlineSnapshot(`
        "
        ---

        ### ⚠ Dependency Lookup Warnings ⚠

        -   \`Warning 1\`
        -   \`Warning 2\`

        Files affected: \`package.json\`, \`backend/package.json\`, \`Dockerfile\`

        "
      `);
    });
  });

  describe('getDepWarnings()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('returns warning text', () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1', topic: undefined }],
              },
              {},
            ],
          },
          {
            packageFile: 'backend/package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1', topic: undefined }],
              },
            ],
          },
        ],
        dockerfile: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                warnings: [{ message: 'Warning 2', topic: undefined }],
              },
            ],
          },
        ],
      };
      const res = getDepWarnings(packageFiles);
      const expectedWarnings = ['Warning 1', 'Warning 2'];
      const expectedWarningFiles = [
        'package.json',
        'backend/package.json',
        'Dockerfile',
      ];
      expect(res).toHaveLength(2);
      expect(res[0]).toEqual(expectedWarnings);
      expect(res[1]).toEqual(expectedWarningFiles);
    });
  });

  describe('getErrors()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      jest.resetAllMocks();
      config = getConfig();
    });

    it('returns error text', () => {
      config.errors = [
        {
          topic: 'renovate.json',
          message: 'Failed to parse',
        },
      ];
      const res = getErrors(config);
      expect(res).toMatchInlineSnapshot(`
        "
        # Errors (1)

        Renovate has found errors that you should fix (in this branch) before finishing this PR.

        -   \`renovate.json\`: Failed to parse

        ---
        "
      `);
    });
  });
});
