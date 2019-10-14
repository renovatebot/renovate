import changelogFilenameRegex from 'changelog-filename-regex';
import { api } from '../../../platform/gitlab/gl-got-wrapper';
import { logger } from '../../../logger';

const glGot = api.get;

export {
  getReleaseList,
  getReleaseNotesMd,
  getReleaseNotes,
  addReleaseNotes,
};

async function getReleaseList(githubApiBaseURL, repository, repoid) {
  logger.trace('getReleaseList()');
  if (!githubApiBaseURL) {
    return [];
  }
  try {
    let url = githubApiBaseURL.replace(/\/?$/, '/');
    logger.debug(`getReleaseList: ${getReleaseList}`);
    url = `${url}projects/${repoid}/releases?per_page=100`;
    const res = await glGot(url);
    return res.body.map(release => ({
      url: '',
      id: release.id,
      tag: release.tag_name,
      name: release.name,
      body: release.description,
      commitid: release.commit.id,
    }));
  } catch (err) {
    logger.info({ repository, err }, 'getReleaseList error');
    return [];
  }
}



async function getReleaseNotes(
  repository,
  version,
  depName,
  githubBaseURL,
  githubApiBaseURL,
  repoid
) {
  logger.trace(`getReleaseNotes(${repository}, ${version}, ${depName})`);
  const releaseList = await getReleaseList(
    githubApiBaseURL,
    repository,
    repoid
  );
  logger.debug(
    `getReleaseList parameters: ${githubApiBaseURL}, ${repository}, ${repoid} release array: ${JSON.stringify(releaseList)}`
  );
  let releaseNotes;
  releaseList.forEach(release => {
    if (
      release.tag === version ||
      release.tag === `v${version}` ||
      release.tag === `${depName}-${version}`
    ) {
      releaseNotes = release;
      releaseNotes.url = `${githubBaseURL}${repository}/commit/${release.commitid}?view=parallel`;
      releaseNotes.body = release.body;
      if (!releaseNotes.body.length) {
        logger.debug(`No release notes found for ${JSON.stringify(release)}`);
        return undefined;
      }
    }
  });
  logger.trace({ releaseNotes });
  return releaseNotes;
}

async function getReleaseNotesMd(
  repository,
  version,
  githubBaseURL,
  githubApiBaseURL,
  repoid
) {
  logger.trace(`getReleaseNotesMd(${repository}, ${version})`);
  let changelogFile;
  let changelogMd = '';
  let filePath = githubApiBaseURL.replace(/\/?$/, '/');
  try {
    let apiPrefix = githubApiBaseURL.replace(/\/?$/, '/');

    apiPrefix = `${apiPrefix}projects/${repoid}/repository/tree?per_page=100`;
    const filesRes = await glGot(apiPrefix);
    const files = filesRes.body
      .map(f => f.path)
      .filter(f => changelogFilenameRegex.test(f.split('/').pop()));
    if (!files.length) {
      logger.trace('no changelog file found');
      return null;
    }

    [changelogFile] = files;
    if (files.length > 1) {
      logger.info(
        `Multiple candidates for changelog file, using ${changelogFile[0]}`
      );
    }
    filePath = `${filePath}projects/${repoid}/repository/files/${changelogFile[0]}?ref=${version}`;
    const fileRes = await glGot(filePath);
    changelogMd =
      Buffer.from(fileRes.body.content, 'base64').toString() + '\n#\n##';
  } catch (err) {
    logger.debug(
      `got ${err.statusCode} for ${filePath} can't fetch changelog file`
    );
    return null;
  }
  const url = `${githubBaseURL}/${repository}`;
  return { changelogMd, url };
}

async function addReleaseNotes(input) {
  if (
    !(
      input &&
      input.project &&
      input.project.github &&
      input.versions &&
      input.project.repoid
    )
  ) {
    logger.debug('Missing project or versions');
    return input;
  }
  const output = { ...input, versions: [] };
  const repository = input.project.github.replace(/\.git$/, '');
  const cacheNamespace = 'changelog-gitlab-notes';
  function getCacheKey(version) {
    return `${repository}:${version}`;
  }
  for (const v of input.versions) {
    let releaseNotes;
    const cacheKey = getCacheKey(v.version);
    releaseNotes = await renovateCache.get(cacheNamespace, cacheKey);
    if (!releaseNotes) {
      releaseNotes = await getReleaseNotes(
        repository,
        v.version,
        input.project.depName,
        input.project.githubBaseURL,
        input.project.githubApiBaseURL,
        input.project.repoid
      );

      if (!releaseNotes) {
        logger.trace(
          `No valid  release notes found for v${v.version} fetching changelog.MD`
        );

        releaseNotes = await getReleaseNotesMd(
          repository,
          v.version,
          input.project.githubBaseURL,
          input.project.githubApiBaseURL,
          input.project.repoid
        );
      }
      if (!releaseNotes && v.compare.url) {
        releaseNotes = { url: v.compare.url };
      }
      const cacheMinutes = 55;
      await renovateCache.set(
        cacheNamespace,
        cacheKey,
        releaseNotes,
        cacheMinutes
      );
    }
    output.versions.push({
      ...v,
      releaseNotes,
    });
    output.hasReleaseNotes = output.hasReleaseNotes || !!releaseNotes;
  }
  return output;
}
