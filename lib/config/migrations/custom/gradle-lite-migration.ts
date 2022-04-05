import is from '@sindresorhus/is';
import { mergeChildConfig } from '../../utils';
import { AbstractMigration } from '../base/abstract-migration';

export class GradleLiteMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'gradle-lite';

  override run(value: unknown): void {
    const gradle = this.get('gradle');

    if (is.nonEmptyObject(value)) {
      const newGradle = mergeChildConfig(gradle ?? {}, value);

      this.setHard('gradle', newGradle);
    }
  }
}
