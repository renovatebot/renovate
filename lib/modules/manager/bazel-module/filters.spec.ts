import { instanceExists } from './filters';

describe('modules/manager/bazel-module/filters', () => {
  it('instanceExists', () => {
    const array: Array<string | null | undefined> = [
      'first',
      null,
      'second',
      undefined,
    ];
    expect(array.filter(instanceExists)).toEqual(['first', 'second']);
  });
});
