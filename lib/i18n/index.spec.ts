import { mocked } from '../../test/util';
import { gt, initI18n } from '.';
import { logger } from '../logger';
import * as _fs from '../util/fs';

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
      expect(gt.locale).toEqual('en');
    });

    it('load translations from the given PO file', async () => {
      await initI18n('zh_CN', './__fixtures__/message.po');
      expect(fs.readSystemFile).toHaveBeenCalledWith(
        './__fixtures__/message.po',
        'utf8'
      );

      expect(gt.locale).toEqual('zh_CN');
      expect(gt.domain).toEqual('messages');
    });

    it('should downgrade to English edition when loading PO file occurred any error', async () => {
      fs.readSystemFile.mockImplementationOnce(() => {
        throw new Error('Can not read the file');
      });

      await initI18n('zh_CN', './__fixtures__/message.po');

      expect(logger.warn).toHaveBeenCalledWith(
        'Occurred some error on reading the PO file Error: Can not read the file, downgrade to English edition'
      );
      expect(gt.locale).toEqual('en');
    });
  });
});
