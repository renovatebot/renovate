import { check } from './regex-glob-matchers.ts';

describe('config/validation-helpers/regex-glob-matchers', () => {
  it('should error for multiple match alls', () => {
    const res = check({
      val: ['*', '**'],
      currentPath: 'hostRules[0].allowedHeaders',
    });
    expect(res.errors).toHaveLength(1);
  });

  it('should error for invalid regex', () => {
    const res = check({
      val: ['[', '/[/', '/.*[/'],
      currentPath: 'hostRules[0].allowedHeaders',
    });
    expect(res.errors).toHaveLength(2);
  });

  it('should error for non-strings', () => {
    const res = check({
      val: ['*', 2],
      currentPath: 'hostRules[0].allowedHeaders',
    });
    expect(res.errors).toMatchObject([
      {
        message:
          'hostRules[0].allowedHeaders: should be an array of strings. You have included object.',
        topic: 'Configuration Error',
      },
    ]);
  });

  it('should warn for unwrapped regex-like patterns', () => {
    const res = check({
      val: ['package.json', '\\.html?$', '^Dockerfile', '\\d+/foo'],
      currentPath: 'npm.managerFilePatterns',
    });
    expect(res.errors).toBeEmptyArray();
    expect(res.warnings).toMatchObject([
      {
        message:
          'npm.managerFilePatterns: the pattern `\\.html?$` looks like a regex but is not wrapped in `/.../`, so it is treated as a glob. Wrap it in slashes if you intended a regex.',
        topic: 'Configuration Warning',
      },
      {
        message:
          'npm.managerFilePatterns: the pattern `^Dockerfile` looks like a regex but is not wrapped in `/.../`, so it is treated as a glob. Wrap it in slashes if you intended a regex.',
        topic: 'Configuration Warning',
      },
      {
        message:
          'npm.managerFilePatterns: the pattern `\\d+/foo` looks like a regex but is not wrapped in `/.../`, so it is treated as a glob. Wrap it in slashes if you intended a regex.',
        topic: 'Configuration Warning',
      },
    ]);
  });

  it('should not warn for valid wrapped regex or plain globs', () => {
    const res = check({
      val: ['/\\.html?$/', '**/*.json', 'package.json'],
      currentPath: 'npm.managerFilePatterns',
    });
    expect(res.errors).toBeEmptyArray();
    expect(res.warnings).toBeEmptyArray();
  });
});
