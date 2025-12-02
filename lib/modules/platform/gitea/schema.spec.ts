import { ContentsListResponse } from './schema';

describe('modules/platform/gitea/schema', () => {
  it('ContentsResponseSchema', () => {
    expect(ContentsListResponse.parse([])).toBeEmptyArray();
  });
});
