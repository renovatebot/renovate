import { ContentsListResponse } from './schema.ts';

describe('modules/platform/gitea/schema', () => {
  it('ContentsResponseSchema', () => {
    expect(ContentsListResponse.parse([])).toBeEmptyArray();
  });
});
