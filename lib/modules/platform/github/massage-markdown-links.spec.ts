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
        'Link [foo/bar#1](https://togithub.com/foo/bar/pull/1) points to [https://github.com/foo/bar/pull/1](https://togithub.com/foo/bar/pull/1).',
        'URL [https://github.com/foo/bar/pull/1](https://togithub.com/foo/bar/pull/1) becomes [foo/bar#1](https://togithub.com/foo/bar/pull/1).',
      ].join('\n'),
    );
  });

  it.each`
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

  it.each`
    input                                                                                     | output
    ${'github.com/foo/bar/discussions/1'}                                                     | ${'[github.com/foo/bar/discussions/1](togithub.com/foo/bar/discussions/1)'}
    ${'github.com/foo/bar/issues/1'}                                                          | ${'[github.com/foo/bar/issues/1](togithub.com/foo/bar/issues/1)'}
    ${'github.com/foo/bar/pull/1'}                                                            | ${'[github.com/foo/bar/pull/1](togithub.com/foo/bar/pull/1)'}
    ${'github.com/Foo/bar/pull/1'}                                                            | ${'[github.com/Foo/bar/pull/1](togithub.com/Foo/bar/pull/1)'}
    ${'www.github.com/foo/bar.foo/pull/1'}                                                    | ${'[www.github.com/foo/bar.foo/pull/1](www.togithub.com/foo/bar.foo/pull/1)'}
    ${'www.github.com/foo/bar/discussions/1'}                                                 | ${'[www.github.com/foo/bar/discussions/1](www.togithub.com/foo/bar/discussions/1)'}
    ${'www.github.com/foo/bar/issues/1'}                                                      | ${'[www.github.com/foo/bar/issues/1](www.togithub.com/foo/bar/issues/1)'}
    ${'www.github.com/foo/bar/pull/1'}                                                        | ${'[www.github.com/foo/bar/pull/1](www.togithub.com/foo/bar/pull/1)'}
    ${'https://github.com/foo/bar/discussions/1'}                                             | ${'[https://github.com/foo/bar/discussions/1](https://togithub.com/foo/bar/discussions/1)'}
    ${'https://github.com/foo/bar/issues/1'}                                                  | ${'[https://github.com/foo/bar/issues/1](https://togithub.com/foo/bar/issues/1)'}
    ${'https://github.com/foo/bar/pull/1'}                                                    | ${'[https://github.com/foo/bar/pull/1](https://togithub.com/foo/bar/pull/1)'}
    ${'https://github.com/foo/bar/discussions/1#comment-123'}                                 | ${'[https://github.com/foo/bar/discussions/1#comment-123](https://togithub.com/foo/bar/discussions/1#comment-123)'}
    ${'https://github.com/foo/bar/issues/1#comment-123'}                                      | ${'[https://github.com/foo/bar/issues/1#comment-123](https://togithub.com/foo/bar/issues/1#comment-123)'}
    ${'https://github.com/foo/bar/pull/1#comment-123'}                                        | ${'[https://github.com/foo/bar/pull/1#comment-123](https://togithub.com/foo/bar/pull/1#comment-123)'}
    ${'[github.com/foo/bar/discussions/1](github.com/foo/bar/discussions/1)'}                 | ${'[github.com/foo/bar/discussions/1](togithub.com/foo/bar/discussions/1)'}
    ${'[github.com/foo/bar/issues/1](github.com/foo/bar/issues/1)'}                           | ${'[github.com/foo/bar/issues/1](togithub.com/foo/bar/issues/1)'}
    ${'[github.com/foo/bar/pull/1](github.com/foo/bar/pull/1)'}                               | ${'[github.com/foo/bar/pull/1](togithub.com/foo/bar/pull/1)'}
    ${'[www.github.com/foo/bar/discussions/1](www.github.com/foo/bar/discussions/1)'}         | ${'[www.github.com/foo/bar/discussions/1](www.togithub.com/foo/bar/discussions/1)'}
    ${'[www.github.com/foo/bar/issues/1](www.github.com/foo/bar/issues/1)'}                   | ${'[www.github.com/foo/bar/issues/1](www.togithub.com/foo/bar/issues/1)'}
    ${'[www.github.com/foo/bar.foo/pull/1](www.github.com/foo/bar.foo/pull/1)'}               | ${'[www.github.com/foo/bar.foo/pull/1](www.togithub.com/foo/bar.foo/pull/1)'}
    ${'[www.github.com/foo/bar/pull/1](www.github.com/foo/bar/pull/1)'}                       | ${'[www.github.com/foo/bar/pull/1](www.togithub.com/foo/bar/pull/1)'}
    ${'[https://github.com/foo/bar/discussions/1](https://github.com/foo/bar/discussions/1)'} | ${'[https://github.com/foo/bar/discussions/1](https://togithub.com/foo/bar/discussions/1)'}
    ${'[https://github.com/foo/bar/issues/1](https://github.com/foo/bar/issues/1)'}           | ${'[https://github.com/foo/bar/issues/1](https://togithub.com/foo/bar/issues/1)'}
    ${'[https://github.com/foo/bar/pull/1](https://github.com/foo/bar/pull/1)'}               | ${'[https://github.com/foo/bar/pull/1](https://togithub.com/foo/bar/pull/1)'}
  `(
    '$input -> $output',
    ({ input, output }: { input: string; output: string }) => {
      expect(massageMarkdownLinks(input)).toEqual(output);
    },
  );
});
