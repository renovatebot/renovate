import { ContentsListResponseSchema } from './schema';

describe('modules/platform/gitea/schema', () => {
  it('ContentsResponseSchema', () => {
    expect(ContentsListResponseSchema.parse([])).toBeEmptyArray();
  });
});
