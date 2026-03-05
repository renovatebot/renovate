import traverse from 'neotraverse/legacy';

export default function configSerializer<T extends Record<string, unknown>>(
  config: T,
): T {
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
      if (arrayFields.includes(key)) {
        this.update('[Array]');
      }
    }
  });
}
