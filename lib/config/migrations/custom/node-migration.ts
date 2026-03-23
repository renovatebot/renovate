import type { RenovateConfig } from '../../types.ts';
import { AbstractMigration } from '../base/abstract-migration.ts';

export class NodeMigration extends AbstractMigration {
  override readonly propertyName = 'node';

  override run(value: unknown): void {
    const node = this.get('node')!;
    // v8 ignore else -- TODO: add test #40625
    if ((value as RenovateConfig).enabled === true) {
      // validated non-null
      delete node.enabled;
      const travis = this.get('travis') ?? {};
      travis.enabled = true;
      if (Object.keys(node).length) {
        this.rewrite(node);
      } else {
        this.delete('node');
      }
      this.setSafely('travis', travis);
    }
  }
}
