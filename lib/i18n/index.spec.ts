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
      await initI18n('zh_CN', './__fixtures__/messages.po');

      expect(fs.readSystemFile).toHaveBeenCalledWith(
        './__fixtures__/messages.po',
        'utf8'
      );

      expect(getLocale()).toBe('zh_CN');
      expect(getDomain()).toBe('messages');
    });

    it('should downgrade to English edition when loading PO file occurred any error', async () => {
      fs.readSystemFile.mockImplementationOnce(() => {
        throw new Error('Can not read the file');
      });

      await initI18n('zh_CN', './__fixtures__/messages.po');

      expect(logger.error).toHaveBeenCalled();
      expect(getLocale()).toBe('en');
    });
  });
});
