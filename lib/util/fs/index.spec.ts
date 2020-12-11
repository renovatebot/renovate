import { getName } from '../../../test/util';
import { getSubDirectory, localPathExists, readLocalFile } from '.';

describe(getName(__filename), () => {
  describe('readLocalFile', () => {
    it('reads buffer', async () => {
      expect(await readLocalFile(__filename)).toBeInstanceOf(Buffer);
    });
    it('reads string', async () => {
      expect(typeof (await readLocalFile(__filename, 'utf8'))).toBe('string');
    });

    it('does not throw', async () => {
      // Does not work on FreeBSD: https://nodejs.org/docs/latest-v10.x/api/fs.html#fs_fs_readfile_path_options_callback
      expect(await readLocalFile(__dirname)).toBeNull();
    });
  });
});

describe(getName(__filename), () => {
  describe('localPathExists', () => {
    it('returns true for file', async () => {
      expect(await localPathExists(__filename)).toBe(true);
    });
    it('returns true for directory', async () => {
      expect(await localPathExists(getSubDirectory(__filename))).toBe(true);
    });
    it('returns false', async () => {
      expect(await localPathExists(__filename.replace('.ts', '.txt'))).toBe(
        false
      );
    });
  });
});
