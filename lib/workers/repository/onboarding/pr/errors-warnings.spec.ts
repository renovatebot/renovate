import { RenovateConfig, getConfig } from '../../../../../test/util';
import type { PackageFile } from '../../../../manager/types';
import { getDepWarnings, getErrors, getWarnings } from './errors-warnings';

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
          depName: 'foo',
          message: 'Failed to look up dependency',
        },
      ];
      const res = getWarnings(config);
      expect(res).toMatchSnapshot();
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
                warnings: [{ message: 'Warning 1', depName: undefined }],
              },
              {},
            ],
          },
          {
            packageFile: 'backend/package.json',
            deps: [
              {
                warnings: [{ message: 'Warning 1', depName: undefined }],
              },
            ],
          },
        ],
        dockerfile: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                warnings: [{ message: 'Warning 2', depName: undefined }],
              },
            ],
          },
        ],
      };
      const res = getDepWarnings(packageFiles);
      expect(res).toMatchSnapshot();
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
          depName: 'renovate.json',
          message: 'Failed to parse',
        },
      ];
      const res = getErrors(config);
      expect(res).toMatchSnapshot();
    });
  });
});
