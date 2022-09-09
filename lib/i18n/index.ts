import { po } from 'gettext-parser';
import Gettext from 'node-gettext';
import { logger } from '../logger';
import { readSystemFile } from '../util/fs';

const gt = new Gettext();

export function _(msgid: string): string {
  return gt.gettext(msgid);
}

export function ngettext(
  msgid: string,
  msgidPlural: string,
  count: number
): string {
  return gt.ngettext(msgid, msgidPlural, count);
}

export function pgettext(msgctxt: string, msgid: string): string {
  return gt.pgettext(msgctxt, msgid);
}

export function getLocale(): string {
  return gt.locale;
}

export function getDomain(): string {
  return gt.domain;
}

// Renovate use single domain to reduce the complexity of 1i8n
const domain = 'messages';

export async function initI18n(translationsFilePath: string): Promise<void> {
  try {
    if (translationsFilePath === '') {
      gt.setLocale('en');
      logger.info('Have not specified --translations-file-path');
      return;
    }

    const translationsContent = await readSystemFile(
      translationsFilePath,
      'utf8'
    );

    if (translationsContent === null) {
      logger.warn('ReadSystemFile for translations content returns null');
      gt.setLocale('en');

      return;
    }

    const parsedTranslations = po.parse(translationsContent);
    const locale: string = parsedTranslations.headers['Language'];

    gt.setLocale(locale);
    gt.addTranslations(locale, domain, parsedTranslations);
  } catch (err) {
    logger.error(
      { err },
      'Occurred some error on reading the PO file, fallback to English edition'
    );

    gt.setLocale('en');
    return;
  }
}
