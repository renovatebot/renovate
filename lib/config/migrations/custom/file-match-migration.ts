import { isArray, isString } from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration.ts';

export class FileMatchMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'fileMatch';

  override run(value: unknown): void {
    // v8 ignore else -- TODO: add test #40625
    if (isString(value) || isArray(value, isString)) {
      const fileMatch = isArray(value) ? value : [value];

      let managerFilePatterns = this.get('managerFilePatterns') ?? [];
      managerFilePatterns = managerFilePatterns.concat(
        fileMatch.map((match) => `/${match}/`),
      );

      this.setHard('managerFilePatterns', managerFilePatterns);
    }
  }
}
