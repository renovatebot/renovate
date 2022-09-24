import { po } from 'gettext-parser';
import Gettext from 'node-gettext';
import { logger } from '../logger';
import { readSystemFile } from '../util/fs';

const gt = new Gettext();

export function gettext(msgid: string): string {
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

export async function initI18n(
  locale: string,
  translationsFilePath: string
): Promise<void> {
  logger.debug(
    `locale ${locale}, translationsFilePath ${translationsFilePath}`
  );

  // The en is the vanilla edition, do not need a PO file to translate
  if (locale === 'en') {
    gt.setLocale('en');
    return;
  }

  try {
    const translationsContent = await readSystemFile(
      translationsFilePath,
      'utf8'
    );

    const parsedTranslations = po.parse(translationsContent);
    gt.addTranslations(locale, domain, parsedTranslations);
    gt.setLocale(locale);
  } catch (err) {
    logger.error(
      { err },
      'Occurred some error on reading the PO file, fallback to English edition'
    );

    gt.setLocale('en');
    return;
  }
}
