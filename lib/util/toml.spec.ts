import { codeBlock } from 'common-tags';
import { parseTOML } from 'toml-eslint-parser';
import { getSingleValue, parse as parseToml, replaceString } from './toml';

describe('util/toml', () => {
  it('works', () => {
    const input = codeBlock`
      [tool.poetry]
      ## Hello world
      include = [
        "README.md",
        { path = "tests", format = "sdist" }
      ]
    `;

    expect(parseToml(input)).toStrictEqual({
      tool: {
        poetry: {
          include: ['README.md', { path: 'tests', format: 'sdist' }],
        },
      },
    });
  });

  it('handles invalid toml', () => {
    const input = codeBlock`
      !@#$%^&*()
    `;

    expect(() => parseToml(input)).toThrow(SyntaxError);
  });

  const rawToml = codeBlock`
version = 'top level version'
ext.version = "version of ext"

[project]
name = 'hello-world'
rev = 3
optional-deps = [
  'dep 0',
  'dep 1',
]

info = {}

[project.ext]
name = '1 ext'

[dependencies]
urllib2.version = 'version of urllib2'
urllib2.build = '*py38*'

'urllib3.ext' = 'version of urllib3.ext'
urllib3 = { version = 'version of urllib3' }
'requests' = "version of requests"
"vc" = 'version of vc'

[[packages]]
name = '0'
version = '0'

[[packages]]
name = '1'
version = '1'
`;

  it('handle AST', () => {
    const ast = parseTOML(rawToml);

    const project = getSingleValue(ast, ['project']);
    expect(project).toStrictEqual(undefined);

    const optionalDeps = getSingleValue(ast, ['project', 'optional-deps']);
    expect(optionalDeps).toStrictEqual(undefined);

    const inlineArray = getSingleValue(ast, ['project', 'optional-deps', 1]);
    expect(inlineArray?.value).toStrictEqual('dep 1');

    const topLevelArray = getSingleValue(ast, ['packages', 1, 'version']);
    expect(topLevelArray?.value).toStrictEqual('1');

    const urllib2Version = getSingleValue(ast, [
      'dependencies',
      'urllib2',
      'version',
    ]);
    expect(urllib2Version?.value).toStrictEqual('version of urllib2');

    const topLevelVersion = getSingleValue(ast, ['version']);
    expect(topLevelVersion?.value).toStrictEqual('top level version');

    const topLevelExtVersion = getSingleValue(ast, ['ext', 'version']);
    expect(topLevelExtVersion?.value).toStrictEqual('version of ext');

    const vcVersion = getSingleValue(ast, ['dependencies', 'vc']);
    expect(vcVersion?.value).toStrictEqual('version of vc');

    const extensionNameAst = getSingleValue(ast, ['project', 'ext', 'name']);
    expect(extensionNameAst?.value).toStrictEqual('1 ext');

    const urllib3AST = getSingleValue(ast, [
      'dependencies',
      'urllib3',
      'version',
    ]);
    expect(urllib3AST?.value).toStrictEqual('version of urllib3');

    const urllib3ExtVersionAST = getSingleValue(ast, [
      'dependencies',
      'urllib3.ext',
    ]);
    expect(urllib3ExtVersionAST?.value).toStrictEqual('version of urllib3.ext');

    const urllib2AST = getSingleValue(ast, [
      'dependencies',
      'urllib2',
      'version',
    ]);
    expect(urllib2AST?.value).toStrictEqual('version of urllib2');

    const projectRev = getSingleValue(ast, ['project', 'rev']);
    expect(projectRev?.value).toStrictEqual(3);

    expect(getSingleValue(ast, ['project'])).toBeUndefined();
    expect(getSingleValue(ast, ['project', 'info'])).toBeUndefined();
    expect(
      getSingleValue(ast, ['project', 'info', 'not-exist']),
    ).toBeUndefined();
  });

  it('replace string content', () => {
    expect(replaceString(rawToml, ['project', 'name'], () => 'hello')).toBe(
      rawToml.replace("name = 'hello-world'", "name = 'hello'"),
    );

    expect(
      replaceString(
        rawToml,
        ['project', 'name'],
        () => "string with a' single quote",
      ),
    ).toBe(
      rawToml.replace(
        "name = 'hello-world'",
        `name = "string with a' single quote"`,
      ),
    );

    expect(replaceString(rawToml, ['ext', 'version'], () => 'hello')).toBe(
      rawToml.replace(
        `ext.version = "version of ext"`,
        `ext.version = "hello"`,
      ),
    );

    expect(replaceString(rawToml, ['project', 'rev'], () => 'hello')).toBe(
      rawToml,
    );
  });
});
