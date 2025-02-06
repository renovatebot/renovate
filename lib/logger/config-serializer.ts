import traverse from 'neotraverse/legacy';
import type { RenovateConfig } from '../config/types';

export default function configSerializer(
  config: RenovateConfig,
): RenovateConfig {
  const templateFields = ['prBody'];
  const contentFields = [
    'content',
    'contents',
    'packageLockParsed',
    'yarnLockParsed',
  ];
  const arrayFields = ['packageFiles', 'upgrades'];

  return traverse(config).map(function scrub(val: string) {
    if (this.key && val) {
      const key = this.key.toString();
      if (templateFields.includes(key)) {
        this.update('[Template]');
      }
      if (contentFields.includes(key)) {
        this.update('[content]');
      }
      // istanbul ignore if
      if (arrayFields.includes(key)) {
        this.update('[Array]');
      }
    }
  });
}
