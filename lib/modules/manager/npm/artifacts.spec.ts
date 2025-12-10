import upath from 'upath';
import * as httpMock from '../../../../test/http-mock';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import type { UpdateArtifactsConfig, Upgrade } from '../types';
import * as rules from './post-update/rules';
import { updateArtifacts } from '.';
import { envMock, mockExecSequence } from '~test/exec-util';
import { env, fs } from '~test/util';

vi.mock('../../../util/exec/env');
vi.mock('../../../util/fs');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
};
const dockerAdminConfig = {
  ...adminConfig,
  binarySource: 'docker',
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
} satisfies RepoGlobalConfig;

process.env.CONTAINERBASE = 'true';

const config: UpdateArtifactsConfig = {};
const validDepUpdate = {
  depName: 'pnpm',
  depType: 'packageManager',
  currentValue:
    '8.15.5+sha256.4b4efa12490e5055d59b9b9fc9438b7d581a6b7af3b5675eb5c5f447cee1a589',
  newVersion: '8.15.6',
} satisfies Upgrade<Record<string, unknown>>;

describe('modules/manager/npm/artifacts', () => {
  const spyProcessHostRules = vi.spyOn(rules, 'processHostRules');

  const integrityB64 =
    'd7iem+d6Kwatj0A6Gcrl4il29hAj+YrTI9XDAZSVjrwC7gpq5dE+5FT2E05OjK8poF8LGg4dKxe8prah8RWfhg==';
  const integrityStr = `sha512-${integrityB64}`;
  const expectedHex =
    '77b89e9be77a2b06ad8f403a19cae5e22976f61023f98ad323d5c30194958ebc02ee0a6ae5d13ee454f6134e4e8caf29a05f0b1a0e1d2b17bca6b6a1f1159f86';
  const expectedPmValue = `pnpm@8.15.6+sha512.${expectedHex}`;

  const mockPnpmIntegrity = (integrity: string | null) => {
    const body =
      integrity === null
        ? { name: 'pnpm', versions: { '8.15.6': {} } }
        : { name: 'pnpm', versions: { '8.15.6': { dist: { integrity } } } };
    httpMock.scope('https://registry.npmjs.org').get('/pnpm').reply(200, body);
  };

  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
    spyProcessHostRules.mockReturnValue({
      additionalNpmrcContent: [],
      additionalYarnRcYml: undefined,
    });
  });

  it('returns null if no packageManager updates present', async () => {
    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ ...validDepUpdate, depName: 'xmldoc', depType: 'patch' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toBeNull();
  });

  it('returns null if currentValue is undefined', async () => {
    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ ...validDepUpdate, currentValue: undefined }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toBeNull();
  });

  it('returns null if currentValue has no hash', async () => {
    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ ...validDepUpdate, currentValue: '8.15.5' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('# dummy') // for npmrc
      .mockResolvedValueOnce('{}') // for node constraints
      .mockResolvedValue(JSON.stringify({ packageManager: expectedPmValue })); // existing package.json

    mockPnpmIntegrity(integrityStr);

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: 'pre-update content',
      config: { ...config },
    });

    expect(res).toBeNull();
  });

  it('returns updated package.json', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('# dummy') // npmrc
      .mockResolvedValueOnce('{}') // node constraints
      .mockResolvedValue(JSON.stringify({ packageManager: 'pnpm@8.15.5' })); // existing package.json

    mockPnpmIntegrity(integrityStr);

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: 'pre-update content',
      config: { ...config },
    });

    const expectedText =
      JSON.stringify({ packageManager: expectedPmValue }, null, 2) + '\n';

    expect(res).toEqual([
      {
        file: {
          contents: expectedText,
          path: 'package.json',
          type: 'addition',
        },
      },
    ]);
  });

  it('supports docker mode', async () => {
    GlobalConfig.set(dockerAdminConfig);

    fs.readLocalFile
      .mockResolvedValueOnce('# dummy') // npmrc
      .mockResolvedValue(JSON.stringify({ packageManager: 'pnpm@8.15.5' })); // existing package.json

    mockPnpmIntegrity('');

    const execSnapshots = mockExecSequence([
      { stdout: '', stderr: '' }, // docker pull
      { stdout: '', stderr: '' }, // docker ps
      { stdout: integrityStr, stderr: '' }, // docker run npm view
    ]);

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: 'pre-update content',
      config: {
        ...config,
        constraints: { node: '20.1.0' },
      },
    });

    const expectedText =
      JSON.stringify({ packageManager: expectedPmValue }, null, 2) + '\n';

    expect(res).toEqual([
      {
        file: {
          contents: expectedText,
          path: 'package.json',
          type: 'addition',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar ' +
          'bash -l -c "' +
          'install-tool node 20.1.0 ' +
          '&& ' +
          'npm view pnpm@8.15.6 dist.integrity' +
          '"',
      },
    ]);
  });

  it('supports install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });

    fs.readLocalFile
      .mockResolvedValueOnce('# dummy') // npmrc
      .mockResolvedValue(JSON.stringify({ packageManager: 'pnpm@8.15.5' })); // existing package.json

    mockPnpmIntegrity('');

    const execSnapshots = mockExecSequence([
      { stdout: '', stderr: '' }, // install-tool node
      { stdout: integrityStr, stderr: '' }, // npm view pnpm@8.15.6 dist.integrity
    ]);

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: 'pre-update content',
      config: {
        ...config,
        constraints: { node: '20.1.0' },
      },
    });

    const expectedText =
      JSON.stringify({ packageManager: expectedPmValue }, null, 2) + '\n';

    expect(res).toEqual([
      {
        file: {
          contents: expectedText,
          path: 'package.json',
          type: 'addition',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'install-tool node 20.1.0',
        options: { cwd: '/tmp/github/some/repo' },
      },
      {
        cmd: 'npm view pnpm@8.15.6 dist.integrity',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('catches errors', async () => {
    mockPnpmIntegrity('');

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: 'pre-update content',
      config: {
        ...config,
        constraints: { node: '20.1.0' },
      },
    });

    expect(res).toEqual([
      {
        artifactError: {
          fileName: 'package.json',
          stderr: expect.stringContaining('No integrity found'),
        },
      },
    ]);
  });

  it('returns artifactError if npm integrity is missing', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('# dummy') // npmrc
      .mockResolvedValueOnce('{}') // node constraints
      .mockResolvedValue(JSON.stringify({ packageManager: 'pnpm@8.15.5' })); // existing package.json

    mockPnpmIntegrity(null);

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: 'pre-update content',
      config: { ...config },
    });

    expect(res).toEqual([
      {
        artifactError: {
          fileName: 'package.json',
          stderr: expect.stringContaining('No integrity found'),
        },
      },
    ]);
  });

  it('returns artifactError on unexpected hex length (sha512)', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('# dummy') // npmrc
      .mockResolvedValueOnce('{}') // node constraints
      .mockResolvedValue(JSON.stringify({ packageManager: 'pnpm@8.15.5' })); // existing package.json

    const integrityStrBadLen = 'sha512-AQID';

    mockPnpmIntegrity(integrityStrBadLen);

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: 'pre-update content',
      config: { ...config },
    });

    expect(res).toEqual([
      {
        artifactError: {
          fileName: 'package.json',
          stderr: expect.stringContaining('Unexpected sha512 hex length'),
        },
      },
    ]);
  });

  it('returns artifactError on unexpected hex length (sha256)', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('# dummy') // npmrc
      .mockResolvedValueOnce('{}') // node constraints
      .mockResolvedValue(JSON.stringify({ packageManager: 'pnpm@8.15.5' })); // existing package.json

    const integrityStrBadLen = 'sha256-AQID';

    mockPnpmIntegrity(integrityStrBadLen);

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: 'pre-update content',
      config: { ...config },
    });

    expect(res).toEqual([
      {
        artifactError: {
          fileName: 'package.json',
          stderr: expect.stringContaining('Unexpected sha256 hex length'),
        },
      },
    ]);
  });

  it('updates package.json when integrity uses sha1 (no expected length check)', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('# dummy') // npmrc
      .mockResolvedValueOnce('{}') // node constraints
      .mockResolvedValue(JSON.stringify({ packageManager: 'pnpm@8.15.5' })); // existing package.json

    const integrityStrSha1 = 'sha1-AQID';
    const expectedHexSha1 = '010203';
    const expectedPmValueSha1 = `pnpm@8.15.6+sha1.${expectedHexSha1}`;

    mockPnpmIntegrity(integrityStrSha1);

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: 'pre-update content',
      config: { ...config },
    });

    const expectedText =
      JSON.stringify({ packageManager: expectedPmValueSha1 }, null, 2) + '\n';
    expect(res).toEqual([
      {
        file: {
          contents: expectedText,
          path: 'package.json',
          type: 'addition',
        },
      },
    ]);
  });

  it('falls back to npm CLI when datasource has no integrity', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('# dummy') // npmrc
      .mockResolvedValueOnce('{}') // node constraints
      .mockResolvedValue(JSON.stringify({ packageManager: 'pnpm@8.15.5' })); // existing package.json

    mockPnpmIntegrity('');

    const execSnapshots = mockExecSequence([
      { stdout: integrityStr, stderr: '' },
    ]);

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: 'pre-update content',
      config: { ...config },
    });

    const expectedText =
      JSON.stringify({ packageManager: expectedPmValue }, null, 2) + '\n';

    expect(res).toEqual([
      {
        file: {
          contents: expectedText,
          path: 'package.json',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'npm view pnpm@8.15.6 dist.integrity' },
    ]);
  });
});
