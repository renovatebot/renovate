import { mockDeep } from 'jest-mock-extended';
import { RenovateConfig, logger, partial } from '../../../test/util';
import type { PackageFile } from '../../modules/manager/types';
import {
  getDepWarningsDashboard,
  getDepWarningsOnboardingPR,
  getErrors,
  getPrWarnings,
  getWarnings,
} from './errors-warnings';

jest.mock('../../logger', () => mockDeep());

describe('workers/repository/errors-warnings', () => {
  describe('getWarnings()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      config = partial<RenovateConfig>();
    });

    it('returns warning text', () => {
      config.warnings = [
        {
          topic: 'foo',
          message: 'Failed to look up dependency',
        },
      ];
      const res = getWarnings(config);
      expect(res).toMatchSnapshot(`
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

  describe('getPrWarnings()', () => {
    it('returns 2 pr warnings text dependencyDashboard true', () => {
      const config: RenovateConfig = {};
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

      const res = getPrWarnings(config, packageFiles, dependencyDashboard);
      expect(res).toMatchSnapshot(`
        "
        ---

        > ⚠️ **Warning**
        >
        > Some dependencies could not be looked up. Check the Dependency Dashboard for more information.

        "
      `);
    });

    it('returns 2 pr warnings text dependencyDashboard false', () => {
      const config: RenovateConfig = {};
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

      const res = getPrWarnings(config, packageFiles, dependencyDashboard);
      expect(res).toMatchSnapshot(`
        "
        ---

        > ⚠️ **Warning**
        >
        > Some dependencies could not be looked up. Check the warning logs for more information.

        "
      `);
    });

    it('PR warning returns empty string', () => {
      const config: RenovateConfig = {};
      const packageFiles: Record<string, PackageFile[]> = {};
      const res = getPrWarnings(config, packageFiles);
      expect(res).toBe('');
    });

    it('suppress notifications contains dependencyLookupWarnings flag then return empty string', () => {
      const config: RenovateConfig = {
        suppressNotifications: ['dependencyLookupWarnings'],
      };
      const packageFiles: Record<string, PackageFile[]> = {};
      const res = getPrWarnings(config, packageFiles);
      expect(res).toBe('');
    });
  });

  it(`shows PR warning if there's a warning in logs`, () => {
    const config: RenovateConfig = { repository: 'org/repo' };
    logger.getProblems.mockReturnValue([
      {
        repository: 'org/repo',
        level: 40,
        msg: 'something',
      }
    ]);
    const packageFiles: Record<string, PackageFile[]> = {};
    const res = getPrWarnings(config, packageFiles);
    expect(res).toMatchSnapshot(`
        "
        ---

        > ⚠️ **Warning**
        >
        > Warnings were raised. Check the logs or Dashboard for more information.

        ---

        "
      `);
  });

  describe('getDepWarningsDashboard()', () => {
    it('returns dependency dashboard warning text', () => {
      const config: RenovateConfig = {};
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
      const res = getDepWarningsDashboard(packageFiles, config);
      expect(res).toMatchSnapshot(`
        "
        ---

        > ⚠️ **Warning**
        >
        > Renovate failed to look up the following dependencies: \`dependency-1\`, \`dependency-2\`.
        >
        > Files affected: \`package.json\`, \`backend/package.json\`, \`Dockerfile\`

        ---

        "
      `);
    });

    it('dependency dashboard warning returns empty string', () => {
      const config: RenovateConfig = {};
      const packageFiles: Record<string, PackageFile[]> = {};
      const res = getDepWarningsDashboard(packageFiles, config);
      expect(res).toBe('');
    });

    it('suppress notifications contains dependencyLookupWarnings flag then return empty string', () => {
      const config: RenovateConfig = {
        suppressNotifications: ['dependencyLookupWarnings'],
      };
      const packageFiles: Record<string, PackageFile[]> = {};
      const res = getDepWarningsDashboard(packageFiles, config);
      expect(res).toBe('');
    });
  });

  describe('getErrors()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      config = partial<RenovateConfig>();
    });

    it('returns error text', () => {
      config.errors = [
        {
          topic: 'renovate.json',
          message: 'Failed to parse',
        },
      ];
      const res = getErrors(config);
      expect(res).toMatchSnapshot(`
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
      const config: RenovateConfig = {};
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
          partial<PackageFile>(), // for coverage
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
          // coverage
          partial<PackageFile>({
            packageFile: 'Dockerfile',
          }),
        ],
      };
      const res = getDepWarningsOnboardingPR(packageFiles, config);
      expect(res).toMatchSnapshot(`
        "
        ---
        >
        > ⚠️ **Warning**
        >
        > Please correct - or verify that you can safely ignore - these dependency lookup failures before you merge this PR.
        >
        > -   \`Warning 1\`
        > -   \`Warning 2\`
        >
        > Files affected: \`package.json\`, \`backend/package.json\`, \`Dockerfile\`

        "
      `);
    });

    it('handle empty package files', () => {
      const config: RenovateConfig = {};
      const packageFiles: Record<string, PackageFile[]> = {
        npm: undefined as never,
      };
      let res = getDepWarningsOnboardingPR(packageFiles, config);
      expect(res).toBe('');
      res = getDepWarningsOnboardingPR(undefined as never, config);
      expect(res).toBe('');
    });

    it('suppress notifications contains dependencyLookupWarnings flag then return empty string', () => {
      const config: RenovateConfig = {
        suppressNotifications: ['dependencyLookupWarnings'],
      };
      const packageFiles: Record<string, PackageFile[]> = {};
      const res = getDepWarningsOnboardingPR(packageFiles, config);
      expect(res).toBe('');
    });

    it('handles undefined', () => {
      const res = getDepWarningsOnboardingPR(undefined as never, {});
      expect(res).toBe('');
    });
  });
});
