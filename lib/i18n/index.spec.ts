import { mocked } from '../../test/util';
import { logger } from '../logger';
import * as _fs from '../util/fs';
import { getDomain, getLocale, initI18n } from '.';

jest.mock('../util/fs');

const fs = mocked(_fs);

describe('i18n/index', () => {
  describe('initI18n', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('do nothing and return when locale is en', async () => {
      await initI18n('en', '');
      expect(fs.readSystemFile).not.toHaveBeenCalled();
      expect(getLocale()).toBe('en');
    });

    it('load translations from the given PO file', async () => {
      await initI18n('zh_CN', './messages.po');

      expect(fs.readSystemFile).toHaveBeenCalledWith('./messages.po', 'utf8');

      expect(getLocale()).toBe('zh_CN');
      expect(getDomain()).toBe('messages');
    });

    it('load translations from the given PO file2', async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore

      fs.readSystemFile.mockReturnValueOnce(null);

      await initI18n('zh_CN', './messages.po');

      expect(logger.warn).toHaveBeenCalledWith(
        'ReadSystemFile for translations content returns null'
      );
    });

    it('should fallback to English edition when loading PO file occurred any error', async () => {
      fs.readSystemFile.mockImplementationOnce(() => {
        throw new Error('Can not read the file');
      });

      await initI18n('zh_CN', './messages.po');

      expect(logger.error).toHaveBeenCalled();
      expect(getLocale()).toBe('en');
    });
  });
});
