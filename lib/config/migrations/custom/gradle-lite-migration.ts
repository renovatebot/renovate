import is from '@sindresorhus/is';
import { mergeChildConfig } from '../../utils';
import { AbstractMigration } from '../base/abstract-migration';

export class GradleLiteMigration extends AbstractMigration {
  readonly propertyName = 'gradle-lite';

  override run(value): void {
    const gradle = this.get('gradle');
    this.delete();

    if (is.nonEmptyObject(value)) {
      const newGradle = mergeChildConfig(gradle ?? {}, value);

      this.setHard('gradle', newGradle);
    }
  }
}
