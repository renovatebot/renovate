import { RenovateConfig, getConfig } from '../../../test/util';
import type { PackageFile } from '../../modules/manager/types';
import {
  getDepWarningsDashboard,
  getDepWarningsOnboardingPR,
  getDepWarningsPR,
  getErrors,
  getWarnings,
} from './errors-warnings';

describe('workers/repository/errors-warnings', () => {
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

    it('getWarning returns empty string', () => {
      config.warnings = [];
      const res = getWarnings(config);
      expect(res).toBe('');
    });
  });

  describe('getDepWarningsPR()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('returns 2 pr warnings text dependencyDashboard true', () => {
      const dependencyDashboard = true;
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1', topic: '' }],
              },
              {},
            ],
          },
          {
            packageFile: 'backend/package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1', topic: '' }],
              },
            ],
          },
        ],
        dockerfile: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                warnings: [{ message: 'Warning 2', topic: '' }],
              },
            ],
          },
        ],
      };

      const res = getDepWarningsPR(packageFiles, dependencyDashboard);
      expect(res).toMatchInlineSnapshot(`
        "
        ---

        ### ⚠ Dependency Lookup Warnings ⚠

        Warnings were logged while processing this repo. Please check the Dependency Dashboard for more information.

        "
      `);
    });

    it('returns 2 pr warnings text dependencyDashboard false', () => {
      const dependencyDashboard = false;
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1', topic: '' }],
              },
              {},
            ],
          },
          {
            packageFile: 'backend/package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1', topic: '' }],
              },
            ],
          },
        ],
        dockerfile: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                warnings: [{ message: 'Warning 2', topic: '' }],
              },
            ],
          },
        ],
      };

      const res = getDepWarningsPR(packageFiles, dependencyDashboard);
      expect(res).toMatchInlineSnapshot(`
        "
        ---

        ### ⚠ Dependency Lookup Warnings ⚠

        Warnings were logged while processing this repo. Please check the logs for more information.

        "
      `);
    });

    it('PR warning returns empty string', () => {
      const packageFiles: Record<string, PackageFile[]> = {};
      const res = getDepWarningsPR(packageFiles);
      expect(res).toBe('');
    });
  });

  describe('getDepWarningsDashboard()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('returns dependency dashboard warning text', () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              {
                warnings: [{ message: 'dependency-1', topic: '' }],
              },
              {},
            ],
          },
          {
            packageFile: 'backend/package.json',
            deps: [
              {
                warnings: [{ message: 'dependency-1', topic: '' }],
              },
            ],
          },
        ],
        dockerfile: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                warnings: [{ message: 'dependency-2', topic: '' }],
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

        -   Renovate failed to look up the following dependencies: \`dependency-1\`, \`dependency-2\`.

        Files affected: \`package.json\`, \`backend/package.json\`, \`Dockerfile\`

        ---

        "
      `);
    });

    it('dependency dashboard warning returns empty string', () => {
      const packageFiles: Record<string, PackageFile[]> = {};
      const res = getDepWarningsDashboard(packageFiles);
      expect(res).toBe('');
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

    it('getError returns empty string', () => {
      config.errors = [];
      const res = getErrors(config);
      expect(res).toBe('');
    });
  });

  describe('getDepWarningsOnboardingPR()', () => {
    it('returns onboarding warning text', () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1', topic: '' }],
              },
              {},
            ],
          },
          {
            packageFile: 'backend/package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1', topic: '' }],
              },
            ],
          },
        ],
        dockerfile: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                warnings: [{ message: 'Warning 2', topic: '' }],
              },
            ],
          },
        ],
      };
      const res = getDepWarningsOnboardingPR(packageFiles);
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
});
