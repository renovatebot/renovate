import { reorderFiles } from './extract';

describe('manager/gradle-lite/extract', () => {
  it('reorderFiles', () => {
    expect(
      reorderFiles([
        'a/b/c/build.gradle',
        'a/build.gradle',
        'a/b/build.gradle',
        'build.gradle',
      ])
    ).toStrictEqual([
      'build.gradle',
      'a/build.gradle',
      'a/b/build.gradle',
      'a/b/c/build.gradle',
    ]);

    expect(reorderFiles(['b.gradle', 'c.gradle', 'a.gradle'])).toStrictEqual([
      'a.gradle',
      'b.gradle',
      'c.gradle',
    ]);

    expect(
      reorderFiles(['b.gradle', 'c.gradle', 'a.gradle', 'gradle.properties'])
    ).toStrictEqual(['gradle.properties', 'a.gradle', 'b.gradle', 'c.gradle']);

    expect(
      reorderFiles([
        'a/b/c/gradle.properties',
        'a/b/c/build.gradle',
        'a/build.gradle',
        'a/gradle.properties',
        'a/b/build.gradle',
        'a/b/gradle.properties',
        'build.gradle',
        'gradle.properties',
        'b.gradle',
        'c.gradle',
        'a.gradle',
      ])
    ).toStrictEqual([
      'gradle.properties',
      'a.gradle',
      'b.gradle',
      'build.gradle',
      'c.gradle',
      'a/gradle.properties',
      'a/build.gradle',
      'a/b/gradle.properties',
      'a/b/build.gradle',
      'a/b/c/gradle.properties',
      'a/b/c/build.gradle',
    ]);
  });
});
