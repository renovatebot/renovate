import { mock } from 'jest-mock-extended';
import { fs, git } from '../../../test/util';
import { Pr } from '../../platform';
import { codeOwnersForPr } from './code-owners';

jest.mock('../../util/fs');
jest.mock('../../util/git');

describe('workers/pr/code-owners', () => {
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
    it('returns more specific code owners', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        ['* @jimmy', 'package.json @john @maria'].join('\n')
      );
      git.getBranchFiles.mockResolvedValueOnce(['package.json']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual(['@john', '@maria']);
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
      expect(codeOwners).toEqual(['@john', '@maria']);
    });
    it('returns empty array when no code owners set', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      git.getBranchFiles.mockResolvedValueOnce(['package.json']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual([]);
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
      fs.readLocalFile.mockImplementationOnce((_, __) => {
        throw new Error();
      });
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual([]);
    });
    const codeOwnerFilePaths = [
      'CODEOWNERS',
      '.github/CODEOWNERS',
      '.gitlab/CODEOWNERS',
      'docs/CODEOWNERS',
    ];
    codeOwnerFilePaths.forEach((codeOwnerFilePath) => {
      it(`detects code owner file at '${codeOwnerFilePath}'`, async () => {
        fs.readLocalFile.mockImplementation((path, _) => {
          if (path === codeOwnerFilePath) {
            return Promise.resolve(['* @mike'].join('\n'));
          }
          return Promise.resolve<string>(null);
        });
        git.getBranchFiles.mockResolvedValueOnce(['README.md']);
        const codeOwners = await codeOwnersForPr(pr);
        expect(codeOwners).toEqual(['@mike']);
      });
    });
  });
});
