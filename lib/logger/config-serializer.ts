import traverse from 'traverse';
import { RenovateConfig } from '../config/common';

export default function configSerializer(
  config: RenovateConfig
): RenovateConfig {
  const redactedFields = [
    'authorization',
    'token',
    'githubAppKey',
    'npmToken',
    'npmrc',
    'yarnrc',
    'privateKey',
    'gitPrivateKey',
    'forkToken',
    'password',
  ];
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
      if (val && redactedFields.includes(this.key)) {
        this.update('***********');
      }
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
