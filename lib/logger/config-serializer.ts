import traverse from 'traverse';
import type { RenovateConfig } from '../config/types';

export default function configSerializer(
  config: RenovateConfig
): RenovateConfig {
  const templateFields = ['prBody'];
  const contentFields = [
    'content',
    'contents',
    'packageLockParsed',
    'yarnLockParsed',
  ];
  const arrayFields = ['packageFiles', 'upgrades'];

  return traverse(config).map(
    // eslint-disable-next-line array-callback-return
    function scrub(val: string) {
      if (val && templateFields.includes(this.key)) {
        this.update('[Template]');
      }
      if (val && contentFields.includes(this.key)) {
        this.update('[content]');
      }
      // istanbul ignore if
      if (val && arrayFields.includes(this.key)) {
        this.update('[Array]');
      }
    }
  );
}
