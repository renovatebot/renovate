import json
import os
from fnmatch import fnmatch


def match(pattern, filename):
    """
    Match `filename` to `pattern`.

    There are glob patterns of two types:
      - Files: those that end with `.spec.ts`,
        should match to either `.spec.ts` or corresponding `*.ts` file
      - Directories: everything else, can end with `/` or not
        (`/**/*` is assumed at the end of the pattern)

    Also, patterns can be negated with `!` prefix.
    """
    if pattern.startswith('!'):
        return not match(pattern[1:], filename)

    if pattern.endswith('.spec.ts'):
        ts_pattern = pattern[:-8] + '.ts'
        return fnmatch(filename, pattern) or fnmatch(filename, ts_pattern)

    if pattern.endswith('/'):
        pattern += '**'
    else:
        pattern += '/**'
    return fnmatch(filename, pattern)

# Tests
assert match('*.spec.ts', 'foo.spec.ts') == True
assert match('!*.spec.ts', 'foo.spec.ts') == False
assert match('!bar.spec.ts', 'foo.spec.ts') == True
assert match('*.spec.ts', 'foo.spec.ts') == True

assert match('foo', 'foo/bar/baz.spec.ts') == True
assert match('!foo', 'foo/bar/baz.spec.ts') == False

assert match('foo/bar', 'foo/bar/baz.spec.ts') == True
assert match('!foo/bar', 'foo/bar/baz.spec.ts') == False

assert match('foo/bar/baz', 'foo/bar/baz.spec.ts') == False
assert match('!foo/bar/baz', 'foo/bar/baz.spec.ts') == True

assert match('foo/bar/baz.spec.ts', 'foo/bar/baz.spec.ts') == True
assert match('foo/bar/baz.spec.ts', 'foo/bar/baz.ts') == True

assert match('foo/**/baz.spec.ts', 'foo/bar/baz.spec.ts') == True
assert match('foo/**/baz.spec.ts', 'foo/bar/baz.ts') == True

assert match('**/baz.spec.ts', 'foo/bar/baz.spec.ts') == True
assert match('**/baz.spec.ts', 'foo/bar/baz.ts') == True

assert match('*/baz.spec.ts', 'foo/bar/baz.spec.ts') == True
assert match('*/baz.spec.ts', 'foo/bar/baz.ts') == True

assert match('x/foo/bar/baz.spec.ts', 'foo/bar/baz.spec.ts') == False
assert match('x/foo/bar/baz.spec.ts', 'foo/bar/baz.ts') == False

assert match('foo/bar', 'foo/bar/baz.txt') == True
assert match('foo/*', 'foo/bar/baz.txt') == True
assert match('foo/*/', 'foo/bar/baz.txt') == True
assert match('foo/bar/baz.spec.ts', 'foo/bar/baz.txt') == False


def get_matching_shards(shards, paths):
    """
    Returns a list of all shards that match at least one of `paths`.
    If one of paths does not match any shard, returns all shards.
    """
    matching_shards_set = set()
    for path in paths:
        for shard, config in shards.items():
            if any(match(pattern, path) for pattern in config['matchPaths']):
                matching_shards_set.add(shard)
                break
        else:
            return list(shards.keys())
    return [shard for shard in shards.keys() if shard in matching_shards_set]

# Tests
test_shards = {
  "shard-1": { "matchPaths": ["lib/foo/bar/baz.spec.ts"], },
  "shard-2": { "matchPaths": ["lib/foo/bar"], },
}
assert get_matching_shards(test_shards, ['lib/foo/bar/baz.ts']) == ['shard-1']
assert get_matching_shards(test_shards, ['lib/foo/bar/baz.spec.ts']) == ['shard-1']
assert get_matching_shards(test_shards, ['lib/foo/bar/baz.ts', 'lib/foo/bar/baz.spec.ts']) == ['shard-1']
assert get_matching_shards(test_shards, ['lib/foo/bar/baz/qux.js']) == ['shard-2']
assert get_matching_shards(test_shards, ['lib/foo/bar/README.md']) == ['shard-2']
assert get_matching_shards(test_shards, ['lib/foo/README.md']) == ['shard-1', 'shard-2']

# Get the list of paths from COMMIT_FILES environment variable (encoded as JSON)
# Read shards from `.test-shards.json` and print matching shards to stdout as JSON prepended with `test-shards=`
commit_files = json.loads(os.environ['COMMIT_FILES'])
shards = json.load(open('.test-shards.json'))
matching_shards = get_matching_shards(shards, commit_files)
print('shards-all=' + json.dumps(list(shards.keys())))
print('shards-matched=' + json.dumps(matching_shards))
