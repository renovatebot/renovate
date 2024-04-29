import { check } from './regex-glob-matchers';

describe('config/validation-helpers/regex-glob-matchers', () => {
  it('should have errors', () => {
    const res = check({
      val: ['*', '**'],
      currentPath: 'hostRules[0].allowedHeaders',
    });
    expect(res).toHaveLength(1);
  });

  it('should have errors - 2', () => {
    const res = check({
      val: ['*', 2] as never,
      currentPath: 'hostRules[0].allowedHeaders',
    });
    expect(res).toMatchObject([
      {
        message:
          'hostRules[0].allowedHeaders: should be an array of strings. You have included object.',
        topic: 'Configuration Error',
      },
    ]);
  });
});
