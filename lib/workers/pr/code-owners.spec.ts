import { mock } from 'jest-mock-extended';
import { mocked, platform: platformMock } from '../../../test/util';
import { Pr, platform } from '../../platform';
import { codeOwnersForPr } from './code-owners';


describe('workers/pr/code-owners', () => {
  describe('codeOwnersForPr', () => {
    let pr: Pr;
    beforeEach(() => {
      jest.resetAllMocks();
      pr = mock<Pr>();
    });
    it('returns global code owner', async () => {
      platformMock.getFile.mockResolvedValueOnce(['* @jimmy'].join('\n'));
      platformMock.getPrFiles.mockResolvedValueOnce(['README.md']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual(['@jimmy']);
    });
    it('returns more specific code owners', async () => {
      platformMock.getFile.mockResolvedValueOnce(
        ['* @jimmy', 'package.json @john @maria'].join('\n')
      );
      platformMock.getPrFiles.mockResolvedValueOnce(['package.json']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual(['@john', '@maria']);
    });
    it('ignores comments and leading/trailing whitespace', async () => {
      platformMock.getFile.mockResolvedValueOnce(
        [
          '# comment line',
          '    \t    ',
          '   * @jimmy     ',
          '        # comment line with leading whitespace',
          ' package.json @john @maria  ',
        ].join('\n')
      );
      platformMock.getPrFiles.mockResolvedValueOnce(['package.json']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual(['@john', '@maria']);
    });
    it('returns empty array when no code owners set', async () => {
      platformMock.getFile.mockResolvedValueOnce(null);
      platformMock.getPrFiles.mockResolvedValueOnce(['package.json']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual([]);
    });
    it('returns empty array when no code owners match', async () => {
      platformMock.getFile.mockResolvedValueOnce(
        ['package-lock.json @mike'].join('\n')
      );
      platformMock.getPrFiles.mockResolvedValueOnce(['yarn.lock']);
      const codeOwners = await codeOwnersForPr(pr);
      expect(codeOwners).toEqual([]);
    });
    it('returns empty array when error occurs', async () => {
      platformMock.getFile.mockImplementationOnce((_, __) => {
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
        platformMock.getFile.mockImplementation((path, _) => {
          if (path === codeOwnerFilePath) {
            return Promise.resolve(['* @mike'].join('\n'));
          }
          return Promise.resolve(null);
        });
        platformMock.getPrFiles.mockResolvedValueOnce(['README.md']);
        const codeOwners = await codeOwnersForPr(pr);
        expect(codeOwners).toEqual(['@mike']);
      });
    });
  });
});
