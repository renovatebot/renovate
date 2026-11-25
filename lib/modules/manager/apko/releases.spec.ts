import { Header, Pack, ReadEntry } from 'tar';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { coerceArray } from '../../../util/array.ts';
import { getPkgReleases } from '../../datasource/index.ts';
import type { ReleaseResult } from '../../datasource/types.ts';

const x86 = 'https://packages.wolfi.dev/os?arch=x86_64';
const arm = 'https://packages.wolfi.dev/os?arch=aarch64';

async function apkIndex(versions: string[]): Promise<Buffer> {
  const lines = versions.flatMap((version) => ['P:bash', `V:${version}`, '']);
  const content = lines.join('\n');
  const pack = new Pack({ gzip: true });
  const data = Buffer.from(content, 'utf8');
  const header = new Header({
    path: 'APKINDEX',
    size: data.length,
    type: 'File',
  });
  const readEntry = new ReadEntry(header);
  readEntry.end(data);
  pack.add(readEntry);
  pack.end();

  const chunks: Buffer[] = [];
  for await (const chunk of pack) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function versionsOf(result: ReleaseResult | null): string[] {
  return coerceArray(result?.releases)
    .map((release) => release.version)
    .sort();
}

describe('modules/manager/apko/releases', () => {
  let cacheDir: DirectoryResult | null;

  beforeEach(async () => {
    cacheDir = await dir({ unsafeCleanup: true });
    GlobalConfig.set({ cacheDir: cacheDir.path });
  });

  afterEach(async () => {
    await cacheDir?.cleanup();
    cacheDir = null;
  });

  it('keeps a version only when every architecture index contains it', async () => {
    httpMock
      .scope('https://packages.wolfi.dev')
      .get('/os/x86_64/APKINDEX.tar.gz')
      .reply(200, await apkIndex(['5.2.37-r2', '5.2.37-r3']))
      .get('/os/aarch64/APKINDEX.tar.gz')
      .reply(200, await apkIndex(['5.2.37-r2']));

    const result = await getPkgReleases({
      datasource: 'apk',
      packageName: 'bash',
      registryUrls: [x86, arm],
    });

    expect(versionsOf(result)).toEqual(['5.2.37-r2']);
  });

  it('offers no version when one architecture index is missing', async () => {
    httpMock
      .scope('https://packages.wolfi.dev')
      .get('/os/x86_64/APKINDEX.tar.gz')
      .reply(200, await apkIndex(['5.2.37-r3']))
      .get('/os/aarch64/APKINDEX.tar.gz')
      .reply(404);

    const result = await getPkgReleases({
      datasource: 'apk',
      packageName: 'bash',
      registryUrls: [x86, arm],
    });

    expect(versionsOf(result)).toEqual([]);
  });

  it('offers no version when one architecture index has no such package', async () => {
    httpMock
      .scope('https://packages.wolfi.dev')
      .get('/os/x86_64/APKINDEX.tar.gz')
      .reply(200, await apkIndex(['5.2.37-r3']))
      .get('/os/aarch64/APKINDEX.tar.gz')
      .reply(200, await apkIndex([]));

    const result = await getPkgReleases({
      datasource: 'apk',
      packageName: 'bash',
      registryUrls: [x86, arm],
    });

    expect(versionsOf(result)).toEqual([]);
  });
});
