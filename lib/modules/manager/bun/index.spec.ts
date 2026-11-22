import * as template from '../../../util/template/index.ts';
import { defaultConfig } from './index.ts';

describe('modules/manager/bun/index', () => {
  it('links the change to the looked up package', () => {
    expect(
      template.compile(defaultConfig.prBodyDefinitions.Change, {
        depName: 'vitest@>2.1.9 <=3.1.2>vite',
        packageName: 'vite',
        currentValue: '6.2.5',
        newValue: '6.2.6',
        currentVersion: '6.2.5',
        newVersion: '6.2.6',
      }),
    ).toBe(
      '[`6.2.5` → `6.2.6`](https://renovatebot.com/diffs/npm/vite/6.2.5/6.2.6)',
    );
  });
});
