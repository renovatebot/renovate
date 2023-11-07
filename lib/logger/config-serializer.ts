import traverse from 'traverse';
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
      if (templateFields.includes(this.key)) {
        this.update('[Template]');
      }
      if (contentFields.includes(this.key)) {
        this.update('[content]');
      }
      // istanbul ignore if
      if (arrayFields.includes(this.key)) {
        this.update('[Array]');
      }
    }
  });
}
