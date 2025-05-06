import is from '@sindresorhus/is';
import { AbstractMigration } from '../base/abstract-migration';

export class FileMatchMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'fileMatch';

  override run(value: unknown): void {
    if (is.string(value) || is.array(value, is.string)) {
      const fileMatch = is.array(value) ? value : [value];

      let managerFilePatterns = this.get('managerFilePatterns') ?? [];
      managerFilePatterns = managerFilePatterns.concat(
        fileMatch.map((match) => `/${match}/`),
      );

      this.setHard('managerFilePatterns', managerFilePatterns);
    }
  }
}
