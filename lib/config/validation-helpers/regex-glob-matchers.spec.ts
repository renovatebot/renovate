import { check } from './regex-glob-matchers';

describe('config/validation-helpers/regex-glob-matchers', () => {
  it('should error for multiple match alls', () => {
    const res = check({
      val: ['*', '**'],
      currentPath: 'hostRules[0].allowedHeaders',
    });
    expect(res).toHaveLength(1);
  });

  it('should error for invalid regex', () => {
    const res = check({
      val: ['[', '/[/', '/.*[/'],
      currentPath: 'hostRules[0].allowedHeaders',
    });
    expect(res).toHaveLength(2);
  });

  it('should error for non-strings', () => {
    const res = check({
      val: ['*', 2],
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
