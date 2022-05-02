import { RenovateConfig, getConfig } from '../../../../../test/util';
import { getErrors, getWarnings } from './errors-warnings';

describe('workers/repository/config-migration/pr/errors-warnings', () => {
  let config: RenovateConfig;

  beforeEach(() => {
    jest.resetAllMocks();
    config = getConfig();
  });

  describe('getWarnings()', () => {
    it('returns warning text', () => {
      config.warnings = [
        {
          topic: 'WARNING',
          message: 'Something went wrong',
        },
      ];
      const res = getWarnings(config);
      expect(res).toMatchInlineSnapshot(`
        "
        # Warnings (1)

        Please correct - or verify that you can safely ignore - these warnings before you merge this PR.

        -   \`WARNING\`: Something went wrong

        ---
        "
      `);
    });
  });

  describe('getErrors()', () => {
    it('returns error text', () => {
      config.errors = [
        {
          topic: 'Error',
          message: 'An error occurred',
        },
      ];
      const res = getErrors(config);
      expect(res).toMatchInlineSnapshot(`
        "
        # Errors (1)

        Renovate has found errors that you should fix (in this branch) before finishing this PR.

        -   \`Error\`: An error occurred

        ---
        "
      `);
    });
  });
});
