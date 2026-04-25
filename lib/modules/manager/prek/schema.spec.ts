import { PrekTomlSchema } from './schema.ts';

describe('modules/manager/prek/schema', () => {
  it('strips unknown top-level fields', () => {
    expect(PrekTomlSchema.parse('minimum_prek_version = "0.1.0"')).toEqual({});
  });

  it('strips unknown repo-level and hook-level fields', () => {
    expect(
      PrekTomlSchema.parse(`[[repos]]
repo = "https://github.com/crate-ci/typos"
rev = "v1.44.0"
managed = true

[[repos.hooks]]
id = "typos"
language = "python"
additional_dependencies = ["requests==1.1.1"]
extra = "value"`),
    ).toEqual({
      repos: [
        {
          repo: 'https://github.com/crate-ci/typos',
          rev: 'v1.44.0',
          hooks: [
            {
              id: 'typos',
              language: 'python',
              additional_dependencies: ['requests==1.1.1'],
            },
          ],
        },
      ],
    });
  });
});
