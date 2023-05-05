import { exists } from './filters';

describe('modules/manager/bazel-module/filters', () => {
  it('exists', () => {
    const array: Array<string | null | undefined> = [
      'first',
      null,
      'second',
      undefined,
    ];
    expect(array.filter(exists)).toEqual(['first', 'second']);
  });
});
