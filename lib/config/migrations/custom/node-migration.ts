import type { RenovateConfig } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class NodeMigration extends AbstractMigration {
  override readonly propertyName = 'node';

  override run(value: unknown): void {
    const node = this.get('node') as RenovateConfig;
    if ((value as RenovateConfig).enabled === true) {
      // validated non-null
      delete node.enabled;
      const travis = (this.get('travis') ?? {}) as RenovateConfig;
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
