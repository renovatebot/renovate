import { fs, getName } from '../../../../../test/util';
import { readHomeDirFiles } from './home-dir';

jest.mock('../../../../util/fs');

describe(getName(), () => {
  describe('readHomeDirFiles()', () => {
    it('returns null if no file', async () => {
      expect(await readHomeDirFiles()).toBeNull();
    });

    it('parses .npmrc', async () => {
      const content = [
        'registry=https://registry.npmjs.org/',
        '_auth=abc123',
        '_authToken=def456',
        '//registry.npmjs.org/:_authToken=aaaaaa111111-bbbbbb222222',
        '//registry.npmjs.org/:_auth=afafafaf==',
        '@renovate:registry=https://registry.renovatebot.com/',
      ];
      fs.readFile.mockResolvedValueOnce(content.join('\n'));
      expect((await readHomeDirFiles()).config).toMatchSnapshot();
    });
  });
});
