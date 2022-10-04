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
      await initI18n('');
      expect(fs.readSystemFile).not.toHaveBeenCalled();
      expect(getLocale()).toBe('en');
    });

    it('load translations from the given PO file', async () => {
      fs.readSystemFile.mockReturnValueOnce(`
        # Language zh-CN translations for renovate-platform package.
        # Copyright (C) 2022 THE renovate-platform'S COPYRIGHT HOLDER
        # This file is distributed under the same license as the renovate-platform package.
        # xingxing <wadexing@gmail.com>, 2022.
        #
        msgid ""
        msgstr ""
        "Project-Id-Version: renovate-platform\n"
        "Report-Msgid-Bugs-To: \n"
        "POT-Creation-Date: 2022-09-30 10:25+0800\n"
        "PO-Revision-Date: 2022-09-29 17:55+0800\n"
        "Last-Translator: xingxing <wadexing@gmail.com>\n"
        "Language-Team: Language zh_CN\n"
        "Language: zh_CN\n"
        "MIME-Version: 1.0\n"
        "Content-Type: text/plain; charset=UTF-8\n"
        "Content-Transfer-Encoding: 8bit\n"
        "Plural-Forms: nplurals=2; plural=(n!=1)\n"
      `);

      await initI18n('./messages.po');

      expect(fs.readSystemFile).toHaveBeenCalledWith('./messages.po', 'utf8');

      expect(getLocale()).toBe('zh_CN');
      expect(getDomain()).toBe('messages');
    });

    it('load translations from the given PO file, but return null', async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore

      fs.readSystemFile.mockReturnValueOnce(null);

      await initI18n('./messages.po');

      expect(logger.warn).toHaveBeenCalledWith(
        'ReadSystemFile for translations content returns null'
      );
    });

    it('should fallback to English edition when loading PO file occurred any error', async () => {
      fs.readSystemFile.mockImplementationOnce(() => {
        throw new Error('Can not read the file');
      });

      await initI18n('./messages.po');

      expect(logger.error).toHaveBeenCalled();
      expect(getLocale()).toBe('en');
    });
  });
});
