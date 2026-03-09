import { ContentsListResponse } from './schema.ts';

describe('modules/platform/forgejo/schema', () => {
  it('ContentsResponseSchema', () => {
    expect(ContentsListResponse.parse([])).toBeEmptyArray();
  });
});
