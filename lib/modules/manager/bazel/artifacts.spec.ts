import { codeBlock } from 'common-tags';
import { updateArtifacts } from './artifacts';

describe('modules/manager/bazel/artifacts', () => {
  it('updates docker hash', () => {
    const upgrade = {
      depType: 'container_pull',
      newDigest:
        'sha256:68860dbd05e72e5ddd8d1093e49469f6b176fbae5d0bf23b0da492f438ae1fc2',
      managerData: { idx: 0 },
    };

    const res = updateArtifacts({
      packageFileName: 'WORKSPACE',
      updatedDeps: [upgrade],
      newPackageFileContent: codeBlock`
        container_pull(
          name="redmine",
          registry="index.docker.io",
          repository="redmine",
          digest="sha256:aac20cf437cb32b160a853b0abe3fb82b0ec91052ebe51eabc9a3474a34e5cc9",
          tag="5.0.4"
        )
      `,
      config: {},
    });

    expect(res).toEqual([
      {
        file: {
          contents: codeBlock`
            container_pull(
              name="redmine",
              registry="index.docker.io",
              repository="redmine",
              digest="sha256:68860dbd05e72e5ddd8d1093e49469f6b176fbae5d0bf23b0da492f438ae1fc2",
              tag="5.0.4"
            )
          `,
          path: 'WORKSPACE',
          type: 'addition',
        },
      },
    ]);
  });
});
