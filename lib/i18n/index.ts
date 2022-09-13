import Gettext from 'node-gettext';
import fs from 'fs';
import { po } from 'gettext-parser';
import { logger } from '../logger';

export const gt = new Gettext();

export function initI18n(locale: string, translationsFilePath: string): void {
  logger.debug(
    `locale ${locale}, translationsFilePath ${translationsFilePath}`
  );

  // The en is the vanilla edition, do not need a PO file to translate
  if (locale === 'en') {
    return;
  }

  try {
    const translationsContent = fs.readFileSync(translationsFilePath);
  } catch (err) {
    logger.warn(
      `Occurred some error on reading the PO file ${err}, downgrade to English edition`
    );
    gt.setLocale('en');
    return;
  }

  const parsedTranslations = po.parse(translationsContent);

  const domain = 'messages';
  gt.addTranslations(locale, domain, parseTranslations);
  gt.setLocale(locale);
}
