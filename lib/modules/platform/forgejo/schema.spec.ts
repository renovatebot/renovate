import { ContentsListResponse } from './schema.ts';

describe('modules/platform/forgejo/schema', () => {
  it('ContentsListResponse', () => {
    expect(ContentsListResponse.parse([])).toBeEmptyArray();
  });
});
