import { massageMarkdownLinks } from './massage-markdown-links';

describe('modules/platform/github/massage-markdown-links', () => {
  it('performs multiple replacements', () => {
    const input = [
      'Link [foo/bar#1](https://github.com/foo/bar/pull/1) points to https://github.com/foo/bar/pull/1.',
      'URL https://github.com/foo/bar/pull/1 becomes [foo/bar#1](https://github.com/foo/bar/pull/1).',
    ].join('\n');
    const res = massageMarkdownLinks(input);
    expect(res).toEqual(
      [
        'Link [foo/bar#1](https://togithub.com/foo/bar/pull/1) points to [foo/bar#1](https://togithub.com/foo/bar/pull/1).',
        'URL [foo/bar#1](https://togithub.com/foo/bar/pull/1) becomes [foo/bar#1](https://togithub.com/foo/bar/pull/1).',
      ].join('\n')
    );
  });

  test.each`
    input
    ${'github.com'}
    ${'github.com/foo/bar'}
    ${'github.com/foo/bar/'}
    ${'github.com/foo/bar/discussions'}
    ${'github.com/foo/bar/issues'}
    ${'github.com/foo/bar/pull'}
    ${'github.com/foo/bar/discussions/'}
    ${'github.com/foo/bar/issues/'}
    ${'github.com/foo/bar/pull/'}
    ${'www.github.com'}
    ${'www.github.com/foo/bar'}
    ${'www.github.com/foo/bar/'}
    ${'www.github.com/foo/bar/discussions'}
    ${'www.github.com/foo/bar/issues'}
    ${'www.github.com/foo/bar/pull'}
    ${'www.github.com/foo/bar/discussions/'}
    ${'www.github.com/foo/bar/issues/'}
    ${'www.github.com/foo/bar/pull/'}
    ${'https://github.com'}
    ${'https://github.com/foo/bar'}
    ${'https://github.com/foo/bar/'}
    ${'https://github.com/foo/bar/discussions'}
    ${'https://github.com/foo/bar/issues'}
    ${'https://github.com/foo/bar/pull'}
    ${'https://github.com/foo/bar/discussions/'}
    ${'https://github.com/foo/bar/issues/'}
    ${'https://github.com/foo/bar/pull/'}
    ${'api.github.com'}
    ${'togithub.com'}
    ${'www.togithub.com'}
    ${'https://togithub.com/foo/bar/releases/tag/v0.20.3'}
    ${'https://togithub.com/foo/bar/compare/v0.20.2...v0.20.3'}
  `('Unchanged: $input', ({ input }: { input: string }) => {
    const inputText = `Foo ${input}, bar.`;
    expect(massageMarkdownLinks(inputText)).toEqual(inputText);

    const inputLink = `[foobar](${input})`;
    expect(massageMarkdownLinks(inputLink)).toEqual(inputLink);
  });

  test.each`
    input                                                                                     | output
    ${'github.com/foo/bar/discussions/1'}                                                     | ${'[foo/bar#1](togithub.com/foo/bar/discussions/1)'}
    ${'github.com/foo/bar/issues/1'}                                                          | ${'[foo/bar#1](togithub.com/foo/bar/issues/1)'}
    ${'github.com/foo/bar/pull/1'}                                                            | ${'[foo/bar#1](togithub.com/foo/bar/pull/1)'}
    ${'github.com/Foo/bar/pull/1'}                                                            | ${'[Foo/bar#1](togithub.com/Foo/bar/pull/1)'}
    ${'www.github.com/foo/bar/discussions/1'}                                                 | ${'[foo/bar#1](www.togithub.com/foo/bar/discussions/1)'}
    ${'www.github.com/foo/bar/issues/1'}                                                      | ${'[foo/bar#1](www.togithub.com/foo/bar/issues/1)'}
    ${'www.github.com/foo/bar/pull/1'}                                                        | ${'[foo/bar#1](www.togithub.com/foo/bar/pull/1)'}
    ${'https://github.com/foo/bar/discussions/1'}                                             | ${'[foo/bar#1](https://togithub.com/foo/bar/discussions/1)'}
    ${'https://github.com/foo/bar/issues/1'}                                                  | ${'[foo/bar#1](https://togithub.com/foo/bar/issues/1)'}
    ${'https://github.com/foo/bar/pull/1'}                                                    | ${'[foo/bar#1](https://togithub.com/foo/bar/pull/1)'}
    ${'https://github.com/foo/bar/discussions/1#comment-123'}                                 | ${'[foo/bar#1#comment-123](https://togithub.com/foo/bar/discussions/1#comment-123)'}
    ${'https://github.com/foo/bar/issues/1#comment-123'}                                      | ${'[foo/bar#1#comment-123](https://togithub.com/foo/bar/issues/1#comment-123)'}
    ${'https://github.com/foo/bar/pull/1#comment-123'}                                        | ${'[foo/bar#1#comment-123](https://togithub.com/foo/bar/pull/1#comment-123)'}
    ${'[github.com/foo/bar/discussions/1](github.com/foo/bar/discussions/1)'}                 | ${'[github.com/foo/bar/discussions/1](togithub.com/foo/bar/discussions/1)'}
    ${'[github.com/foo/bar/issues/1](github.com/foo/bar/issues/1)'}                           | ${'[github.com/foo/bar/issues/1](togithub.com/foo/bar/issues/1)'}
    ${'[github.com/foo/bar/pull/1](github.com/foo/bar/pull/1)'}                               | ${'[github.com/foo/bar/pull/1](togithub.com/foo/bar/pull/1)'}
    ${'[www.github.com/foo/bar/discussions/1](www.github.com/foo/bar/discussions/1)'}         | ${'[www.github.com/foo/bar/discussions/1](www.togithub.com/foo/bar/discussions/1)'}
    ${'[www.github.com/foo/bar/issues/1](www.github.com/foo/bar/issues/1)'}                   | ${'[www.github.com/foo/bar/issues/1](www.togithub.com/foo/bar/issues/1)'}
    ${'[www.github.com/foo/bar/pull/1](www.github.com/foo/bar/pull/1)'}                       | ${'[www.github.com/foo/bar/pull/1](www.togithub.com/foo/bar/pull/1)'}
    ${'[https://github.com/foo/bar/discussions/1](https://github.com/foo/bar/discussions/1)'} | ${'[https://github.com/foo/bar/discussions/1](https://togithub.com/foo/bar/discussions/1)'}
    ${'[https://github.com/foo/bar/issues/1](https://github.com/foo/bar/issues/1)'}           | ${'[https://github.com/foo/bar/issues/1](https://togithub.com/foo/bar/issues/1)'}
    ${'[https://github.com/foo/bar/pull/1](https://github.com/foo/bar/pull/1)'}               | ${'[https://github.com/foo/bar/pull/1](https://togithub.com/foo/bar/pull/1)'}
  `(
    '$input -> $output',
    ({ input, output }: { input: string; output: string }) => {
      expect(massageMarkdownLinks(input)).toEqual(output);
    }
  );

  it('replace url contains disappear text inline', () => {
    const input = [
      'pnpm rebuild accepts --store-dir by @&#8203;user in https://github.com/foo/bar/issues/1\n' +
        'pnpm rebuild accepts --store-dir by @&#8203;UsEr in https://github.com/foo/bar/issues/2\n' +
        'pnpm rebuild accepts --store-dir by @&#8203;user-name in https://github.com/foo/bar/issues/3',
    ].join('\n');
    const res = massageMarkdownLinks(input);
    expect(res).toEqual(
      [
        'pnpm rebuild accepts --store-dir by [@user](https://togithub.com/user) in [foo/bar#1](https://togithub.com/foo/bar/issues/1)\n' +
          'pnpm rebuild accepts --store-dir by [@UsEr](https://togithub.com/UsEr) in [foo/bar#2](https://togithub.com/foo/bar/issues/2)\n' +
          'pnpm rebuild accepts --store-dir by [@user-name](https://togithub.com/user-name) in [foo/bar#3](https://togithub.com/foo/bar/issues/3)',
      ].join('\n')
    );
  });
});
