import { mock } from 'jest-mock-extended';
import { platform } from '../../../test/util';
import { Pr } from '../../platform';
import { codeOwnersForPr } from './code-owners';

describe('workers/pr/code-owners', () => {
  describe('codeOwnersForPr', () => {
    let pr: Pr;
    beforeEach(() => {
      jest.resetAllMocks();
      pr = mock<Pr>();
    });
    it('returns global code owner', async () => {
      platform.getFile.mockResolvedValueOnce(['* @jimmy'].join('\n'));
      platform.getPrFiles.mockResolvedValueOnce(['README.md']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual(['@jimmy']);
    });
    it('returns more specific code owners', async () => {
      platform.getFile.mockResolvedValueOnce(
        ['* @jimmy', 'package.json @john @maria'].join('\n')
      );
      platform.getPrFiles.mockResolvedValueOnce(['package.json']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual(['@john', '@maria']);
    });
    it('ignores comments and leading/trailing whitespace', async () => {
      platform.getFile.mockResolvedValueOnce(
        [
          '# comment line',
          '    \t    ',
          '   * @jimmy     ',
          '        # comment line with leading whitespace',
          ' package.json @john @maria  ',
        ].join('\n')
      );
      platform.getPrFiles.mockResolvedValueOnce(['package.json']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual(['@john', '@maria']);
    });
    it('returns empty array when no code owners set', async () => {
      platform.getFile.mockResolvedValueOnce(null);
      platform.getPrFiles.mockResolvedValueOnce(['package.json']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual([]);
    });
    it('returns empty array when no code owners match', async () => {
      platform.getFile.mockResolvedValueOnce(
        ['package-lock.json @mike'].join('\n')
      );
      platform.getPrFiles.mockResolvedValueOnce(['yarn.lock']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual([]);
    });
    it('returns empty array when error occurs', async () => {
      platform.getFile.mockImplementationOnce((_, __) => {
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
        platform.getFile.mockImplementation((path, _) => {
          if (path === codeOwnerFilePath) {
            return Promise.resolve(['* @mike'].join('\n'));
          }
          return Promise.resolve(null);
        });
        platform.getPrFiles.mockResolvedValueOnce(['README.md']);
        const codeOwners = await codeOwnersForPr(pr);
        expect(codeOwners).toEqual(['@mike']);
      });
    });
  });
});
