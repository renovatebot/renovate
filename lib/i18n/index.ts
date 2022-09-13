import Gettext from 'node-gettext';
import { readSystemFile } from '../util/fs';
import { po } from 'gettext-parser';
import { logger } from '../logger';

export const gt = new Gettext();

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
    const domain = 'messages';
    gt.addTranslations(locale, domain, parsedTranslations);
    gt.setLocale(locale);
  } catch (err) {
    logger.warn(
      `Occurred some error on reading the PO file ${err}, downgrade to English edition`
    );
    gt.setLocale('en');
    return;
  }
}
