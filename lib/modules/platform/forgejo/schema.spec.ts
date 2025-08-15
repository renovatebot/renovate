import { ContentsListResponse } from './schema';

describe('modules/platform/forgejo/schema', () => {
  it('ContentsResponseSchema', () => {
    expect(ContentsListResponse.parse([])).toBeEmptyArray();
  });
});
