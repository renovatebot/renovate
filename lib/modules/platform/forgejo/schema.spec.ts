import { ContentsListResponseSchema } from './schema';

describe('modules/platform/forgejo/schema', () => {
  it('ContentsResponseSchema', () => {
    expect(ContentsListResponseSchema.parse([])).toBeEmptyArray();
  });
});
