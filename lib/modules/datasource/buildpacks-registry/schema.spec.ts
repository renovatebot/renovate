import { BuildpacksRegistryResponseSchema } from './schema';

describe('modules/datasource/buildpacks-registry/schema', () => {
  it('parses buildpack-registry schema', () => {
    const response = {
      latest: {
        version: '0.17.1',
        namespace: 'heroku',
        name: 'python',
        description: "Heroku's buildpack for Python applications.",
        homepage: 'https://github.com/heroku/buildpacks-python',
        licenses: ['BSD-3-Clause'],
        stacks: ['*'],
        id: '75946bf8-3f6a-4af0-a757-614bebfdfcd6',
      },
      versions: [
        {
          version: '0.2.0',
          _link:
            'https://registry.buildpacks.io//api/v1/buildpacks/heroku/python/0.2.0',
        },
        {
          version: '0.1.0',
          _link:
            'https://registry.buildpacks.io//api/v1/buildpacks/heroku/python/0.1.0',
        },
      ],
    };
    expect(BuildpacksRegistryResponseSchema.parse(response)).toMatchObject({
      latest: {
        homepage: 'https://github.com/heroku/buildpacks-python',
      },
      versions: [
        {
          version: '0.2.0',
        },
        {
          version: '0.1.0',
        },
      ],
    });
  });
});
