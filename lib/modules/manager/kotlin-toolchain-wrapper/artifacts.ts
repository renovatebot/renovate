import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { getFile } from '../../../util/git/index.ts';
import type { FileAddition } from '../../../util/git/types.ts';
import { Http } from '../../../util/http/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import type {
  ArtifactError,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../types.ts';
import type { ExistingWrapper, ParsedWrapper } from './types.ts';
import {
  disagreement,
  parseWrapper,
  withDownloadRoot,
  wrapperFiles,
} from './utils.ts';

const http = new Http(MavenDatasource.id);

type WrapperUpdate =
  | { artifactError: ArtifactError }
  | { file: FileAddition; wrapper: ParsedWrapper };

function artifactUrl(wrapper: ParsedWrapper, suffix: string): string {
  const { downloadRoot, version } = wrapper;
  return `${downloadRoot}/org/jetbrains/kotlin/kotlin-cli/${version}/kotlin-cli-${version}${suffix}`;
}

async function findExistingWrappers(dir: string): Promise<ExistingWrapper[]> {
  const existing: ExistingWrapper[] = [];
  for (const file of wrapperFiles) {
    const path = upath.join(dir, file.name);
    const contents = await readLocalFile(path, 'utf8');
    if (contents && parseWrapper(contents)) {
      existing.push({ path, file });
    }
  }
  return existing;
}

async function updateWrapperFile(
  existing: ExistingWrapper,
  wrapper: ParsedWrapper,
): Promise<WrapperUpdate> {
  const { path, file } = existing;
  const url = artifactUrl(wrapper, file.artifactSuffix);

  let body: string;
  try {
    ({ body } = await http.getText(url));
  } catch (err) {
    logger.debug({ err, url }, 'Failed to download Kotlin Toolchain wrapper');
    return {
      artifactError: {
        fileName: path,
        stderr: `HTTP GET ${url} failed: ${err.message}`,
      },
    };
  }

  const downloaded = parseWrapper(body);
  if (
    !downloaded ||
    downloaded.version !== wrapper.version ||
    !downloaded.sha256
  ) {
    return {
      artifactError: {
        fileName: path,
        stderr: `Downloaded ${url} is not a Kotlin Toolchain ${wrapper.version} wrapper script`,
      },
    };
  }

  if (downloaded.form !== file.form) {
    return {
      artifactError: {
        fileName: path,
        stderr: `Downloaded ${url} is a ${downloaded.form} script but ${path} must be a ${file.form} script`,
      },
    };
  }

  const contents = withDownloadRoot(body, file.form, wrapper.downloadRoot);
  if (!contents) {
    return {
      artifactError: {
        fileName: path,
        stderr: `Downloaded ${url} has no KOTLIN_CLI_DOWNLOAD_ROOT line to point at ${wrapper.downloadRoot}`,
      },
    };
  }

  return {
    file: {
      type: 'addition',
      path,
      contents,
      isExecutable: file.isExecutable,
    },
    wrapper: { ...downloaded, downloadRoot: wrapper.downloadRoot },
  };
}

/**
 * Auto-replace has bumped the working tree; artifact errors still allow commits.
 * Restore the base-branch script to keep its version and checksum in sync.
 * Omit isExecutable: prepareCommit stages a mode change for a 100644 wrapper.
 */
async function restorePackageFile(
  packageFileName: string,
  existing: ExistingWrapper[],
): Promise<UpdateArtifactsResult[]> {
  const original = existing.find((entry) => entry.path === packageFileName);
  if (!original) {
    return [];
  }

  const contents = await getFile(packageFileName);
  if (!contents) {
    logger.debug(
      { packageFileName },
      'Kotlin Toolchain wrapper script is not on the base branch, nothing to restore',
    );
    return [];
  }

  return [
    {
      file: {
        type: 'addition',
        path: original.path,
        contents,
      },
    },
  ];
}

// Keep the downloaded pair extractable: extraction skips inconsistent wrappers.
function pairDisagreement(
  written: { path: string; wrapper: ParsedWrapper }[],
): string | null {
  const [first, ...siblings] = written;
  for (const sibling of siblings) {
    const difference = disagreement(first.wrapper, sibling.wrapper);
    if (difference) {
      return `Downloaded Kotlin Toolchain wrapper scripts ${first.path} and ${sibling.path} declare different ${difference}`;
    }
  }
  return null;
}

export async function updateArtifacts({
  packageFileName,
  newPackageFileContent,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`kotlin-toolchain-wrapper.updateArtifacts(${packageFileName})`);

  const existing = await findExistingWrappers(upath.dirname(packageFileName));

  const wrapper = parseWrapper(newPackageFileContent);
  if (!wrapper) {
    return [
      {
        artifactError: {
          fileName: packageFileName,
          stderr: `No kotlin_cli_version line in ${packageFileName}`,
        },
      },
      ...(await restorePackageFile(packageFileName, existing)),
    ];
  }

  if (!existing.length) {
    return null;
  }

  const files: UpdateArtifactsResult[] = [];
  const errors: UpdateArtifactsResult[] = [];
  const written: { path: string; wrapper: ParsedWrapper }[] = [];
  for (const entry of existing) {
    const update = await updateWrapperFile(entry, wrapper);
    if ('artifactError' in update) {
      errors.push({ artifactError: update.artifactError });
    } else {
      files.push({ file: update.file });
      written.push({ path: update.file.path, wrapper: update.wrapper });
    }
  }

  if (!errors.length) {
    const difference = pairDisagreement(written);
    if (!difference) {
      return files;
    }
    errors.push({
      artifactError: { fileName: packageFileName, stderr: difference },
    });
  }

  logger.debug(
    { packageFileName },
    'Keeping the Kotlin Toolchain wrapper scripts unchanged after a failed update',
  );
  return [...errors, ...(await restorePackageFile(packageFileName, existing))];
}
