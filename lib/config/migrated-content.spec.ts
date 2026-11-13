import { codeBlock } from 'common-tags';
import { stringifyMigratedConfig } from './migrated-content.ts';

describe('config/migrated-content', () => {
  describe('stringifyMigratedConfig()', () => {
    it('keeps quotes of unchanged JSON5 array elements, but double-quotes top-level strings and added values', () => {
      const raw = codeBlock`
        {
          // a comment
          extends: ['a', "b"],
          timezone: 'x',
          "baseBranchPatterns": ["y"],
          branchPrefix: 'same',
        }
      `;

      const { content } = stringifyMigratedConfig('renovate.json5', raw, {
        extends: ['a', 'b', 'c'],
        timezone: 'z',
        baseBranchPatterns: ['w'],
        branchPrefix: 'same',
        onboardingBranch: 'new',
      });

      expect(content).toBe(
        `${codeBlock`
          {
            // a comment
            extends: ['a', "b", "c"],
            timezone: "z",
            "baseBranchPatterns": ["w"],
            branchPrefix: "same",
            "onboardingBranch": "new",
          }
        `}\n`,
      );
    });
  });
});
