import { RenovateConfig, getConfig, getName } from '../../../../../test/util';
import type { PackageFile } from '../../../../manager/types';
import { getDepWarnings, getErrors, getWarnings } from './errors-warnings';

describe(getName(__filename), () => {
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
          topic: 'renovate.json',
          message: 'Failed to parse',
        },
      ];
      const res = getErrors(config);
      expect(res).toMatchSnapshot();
    });
  });
});
