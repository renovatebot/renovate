import { mock } from 'jest-mock-extended';
import { fs, git } from '../../../../../test/util';
import type { Pr } from '../../../../modules/platform';
import { codeOwnersForPr } from './code-owners';

jest.mock('../../../../util/fs');
jest.mock('../../../../util/git');

describe('workers/repository/update/pr/code-owners', () => {
  describe('codeOwnersForPr', () => {
    let pr: Pr;

    beforeEach(() => {
      jest.resetAllMocks();
      pr = mock<Pr>();
    });

    it('returns global code owner', async () => {
      fs.readLocalFile.mockResolvedValueOnce(['* @jimmy'].join('\n'));
      git.getBranchFiles.mockResolvedValueOnce(['README.md']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual(['@jimmy']);
    });

    it('respects orphan files', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        ['* @jimmy', 'yarn.lock'].join('\n')
      );
      git.getBranchFiles.mockResolvedValueOnce(['yarn.lock']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual([]);
    });

    it('returns more specific code owners', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        ['* @jimmy', 'package.json @john @maria'].join('\n')
      );
      git.getBranchFiles.mockResolvedValueOnce(['package.json']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual(['@john', '@maria', '@jimmy']);
    });

    describe('returns more specific code owners in monorepos', () => {
      const mockCodeOwners = `
        # By default, assign to @john
        #
        * @john

        # Lockfiles are not owned by anyone, any package dependency update may modify them.
        # Assigning lockfiles an owner will cause issues as merge requests to be assigned to incorrect users
        yarn.lock

        # Assign each package to it's respective user
        #
        packages/a/ @maria
        packages/b/ @jimmy
        packages/c/ @dan
        packages/d/ @maria @jimmy
        packages/e/ @jimmy

      `;

      it('does not assign changes for yarn.lock', async () => {
        fs.readLocalFile.mockResolvedValueOnce(mockCodeOwners);
        git.getBranchFiles.mockResolvedValueOnce(['yarn.lock']);
        const codeOwners = await codeOwnersForPr(pr);
        expect(codeOwners).toEqual([]);
      });

      it('assigns root changes to @john (*)', async () => {
        fs.readLocalFile.mockResolvedValueOnce(mockCodeOwners);
        git.getBranchFiles.mockResolvedValueOnce(['package.json', 'yarn.lock']);
        const codeOwners = await codeOwnersForPr(pr);
        expect(codeOwners).toEqual(['@john']);
      });

      it('assigns changes in package A to @maria (a), @john (*)', async () => {
        fs.readLocalFile.mockResolvedValueOnce(mockCodeOwners);
        git.getBranchFiles.mockResolvedValueOnce([
          'packages/a/package.json',
          'yarn.lock',
        ]);
        const codeOwners = await codeOwnersForPr(pr);
        expect(codeOwners).toEqual(['@maria', '@john']);
      });

      it('assigns changes in package B to @jimmy (b), @john (*)', async () => {
        fs.readLocalFile.mockResolvedValueOnce(mockCodeOwners);
        git.getBranchFiles.mockResolvedValueOnce([
          'packages/b/package.json',
          'yarn.lock',
        ]);
        const codeOwners = await codeOwnersForPr(pr);
        expect(codeOwners).toEqual(['@jimmy', '@john']);
      });

      it('assigns changes in package C to @dan (c), @john (*)', async () => {
        fs.readLocalFile.mockResolvedValueOnce(mockCodeOwners);
        git.getBranchFiles.mockResolvedValueOnce([
          'packages/c/package.json',
          'yarn.lock',
        ]);
        const codeOwners = await codeOwnersForPr(pr);
        expect(codeOwners).toEqual(['@dan', '@john']);
      });

      it('assigns changes in package D to @maria (d), @jimmy (d), @john (*)', async () => {
        fs.readLocalFile.mockResolvedValueOnce(mockCodeOwners);
        git.getBranchFiles.mockResolvedValueOnce([
          'packages/d/package.json',
          'yarn.lock',
        ]);
        const codeOwners = await codeOwnersForPr(pr);
        expect(codeOwners).toEqual(['@maria', '@jimmy', '@john']);
      });

      it('assigns changes in package A and B to @maria (a), @jimmy (b), @john (*)', async () => {
        fs.readLocalFile.mockResolvedValueOnce(mockCodeOwners);
        git.getBranchFiles.mockResolvedValueOnce([
          'packages/a/package.json',
          'packages/b/package.json',
          'yarn.lock',
        ]);
        const codeOwners = await codeOwnersForPr(pr);
        expect(codeOwners).toEqual(['@maria', '@jimmy', '@john']);
      });

      it('assigns changes in package A, B and C to @john, @maria (a), @jimmy (b), @dan (c), @john (*)', async () => {
        fs.readLocalFile.mockResolvedValueOnce(mockCodeOwners);
        git.getBranchFiles.mockResolvedValueOnce([
          'packages/a/package.json',
          'packages/b/package.json',
          'packages/c/package.json',
          'yarn.lock',
        ]);
        const codeOwners = await codeOwnersForPr(pr);
        expect(codeOwners).toEqual(['@maria', '@jimmy', '@dan', '@john']);
      });

      it('assigns changes in package C and D to @dan (c), @maria (d), @jimmy (e), @john (*)', async () => {
        fs.readLocalFile.mockResolvedValueOnce(mockCodeOwners);
        git.getBranchFiles.mockResolvedValueOnce([
          'packages/c/package.json',
          'packages/d/package.json',
          'yarn.lock',
        ]);
        const codeOwners = await codeOwnersForPr(pr);
        expect(codeOwners).toEqual(['@dan', '@maria', '@jimmy', '@john']);
      });

      it('assigns changes in package D and E to @jimmy (d, e), @maria (d), @john (*)', async () => {
        fs.readLocalFile.mockResolvedValueOnce(mockCodeOwners);
        git.getBranchFiles.mockResolvedValueOnce([
          'packages/d/package.json',
          'packages/e/package.json',
          'yarn.lock',
        ]);
        const codeOwners = await codeOwnersForPr(pr);
        expect(codeOwners).toEqual(['@jimmy', '@maria', '@john']);
      });
    });

    it('ignores comments and leading/trailing whitespace', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        [
          '# comment line',
          '    \t    ',
          '   * @jimmy     ',
          '        # comment line with leading whitespace',
          ' package.json @john @maria  ',
        ].join('\n')
      );
      git.getBranchFiles.mockResolvedValueOnce(['package.json']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual(['@john', '@maria', '@jimmy']);
    });

    it('returns empty array when no code owners set', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      git.getBranchFiles.mockResolvedValueOnce(['package.json']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toBeEmptyArray();
    });

    it('returns empty array when no code owners match', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        ['package-lock.json @mike'].join('\n')
      );
      git.getBranchFiles.mockResolvedValueOnce(['yarn.lock']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual([]);
    });

    it('returns empty array when error occurs', async () => {
      fs.readLocalFile.mockRejectedValueOnce(new Error());
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toBeEmptyArray();
    });

    const codeOwnerFilePaths = [
      'CODEOWNERS',
      '.github/CODEOWNERS',
      '.gitlab/CODEOWNERS',
      'docs/CODEOWNERS',
    ];
    codeOwnerFilePaths.forEach((codeOwnerFilePath) => {
      it(`detects code owner file at '${codeOwnerFilePath}'`, async () => {
        // TODO: fix types, jest is using wrong overload (#7154)
        fs.readLocalFile.mockImplementation((path): Promise<any> => {
          if (path === codeOwnerFilePath) {
            return Promise.resolve(['* @mike'].join('\n'));
          }
          return Promise.resolve(null);
        });
        git.getBranchFiles.mockResolvedValueOnce(['README.md']);
        const codeOwners = await codeOwnersForPr(pr);
        expect(codeOwners).toEqual(['@mike']);
      });
    });
  });
});
