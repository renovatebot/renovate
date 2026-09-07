import { ModuleExtractor } from './modules.ts';

describe('modules/manager/terraform/extractors/others/modules', () => {
  const extractor = new ModuleExtractor();

  it('return empty array if no module is found', () => {
    const res = extractor.extract({}, [], {});
    expect(res).toBeArrayOfSize(0);
  });

  describe('extract git-tags modules with .git in domain or repo name', () => {
    describe('SSH URL with .git in domain and standard path', () => {
      const source =
        'git::ssh://git@test.git.example.git.com/modules/foo-module.git//bar?ref=v1.0.0';

      it('should extract the correct depName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          depName: 'test.git.example.git.com/modules/foo-module',
          currentValue: 'v1.0.0',
          datasource: 'git-tags',
        });
      });

      it('should extract the correct packageName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          packageName: 'ssh://git@test.git.example.git.com/modules/foo-module',
        });
      });
    });

    describe('SSH URL with .git in domain and colon-separated path', () => {
      const source =
        'git::ssh://git@test.git.example.git.com:modules/foo-module.git//bar?ref=v2.0.0';

      it('should extract the correct depName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          depName: 'test.git.example.git.com:modules/foo-module',
          currentValue: 'v2.0.0',
          datasource: 'git-tags',
        });
      });

      it('should extract the correct packageName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          packageName: 'ssh://git@test.git.example.git.com:modules/foo-module',
        });
      });
    });

    describe('HTTPS URL with .git in domain and no trailing .git', () => {
      const source =
        'git::https://git@test.git.example.git.com/modules/foo-module?ref=v3.0.0';

      it('should extract the correct depName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          depName: 'test.git.example.git.com/modules/foo-module',
          currentValue: 'v3.0.0',
          datasource: 'git-tags',
        });
      });

      it('should extract the correct packageName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          packageName:
            'https://git@test.git.example.git.com/modules/foo-module',
        });
      });
    });

    describe('HTTPS URL with .git in repo name', () => {
      const source =
        'git::https://git@test.example.com/modules.git-repo/foo-module?ref=v3.0.0';

      it('should extract the correct depName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          depName: 'test.example.com/modules.git-repo/foo-module',
          currentValue: 'v3.0.0',
          datasource: 'git-tags',
        });
      });

      it('should extract the correct packageName', () => {
        const res = extractor.extract(
          { module: { foo: [{ source }] } },
          [],
          {},
        );
        expect(res).toHaveLength(1);
        expect(res[0]).toMatchObject({
          packageName:
            'https://git@test.example.com/modules.git-repo/foo-module',
        });
      });
    });
  });
});
