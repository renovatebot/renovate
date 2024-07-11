import type { Release } from '../types';
import { parseGitUrl } from '../../../util/git/url';
import { logger } from '../../../logger';
import { GithubDirectoryResponse } from '../../platform/github/schema';
import semver from '../../versioning/semver';
import { joinUrlParts } from '../../../util/url';
import type { GithubHttp } from '../../../util/http/github';
import { BitriseStepFile } from './schema';
import { parseSingleYaml } from '../../../util/yaml';

export async function fetchPackages(client: GithubHttp,registryUrl: string): Promise<Record<string, Release[]> | null> {

  const parsedUrl = parseGitUrl(registryUrl)
  if (parsedUrl.source !== 'github.com') {
    logger.warn( `${parsedUrl.source} is not a supported Git hoster for this datasource`);
    return null;
  }

  const result: Record<string, Release[]> = {}

  const baseUrl = `https://api.github.com/repos/${parsedUrl.full_name}/contents`;
  const stepsUrl = `${baseUrl}/steps`
  const response = await client.getJson(stepsUrl, )
  const parsed = GithubDirectoryResponse.safeParse(response.body)

  if (!parsed.success) {
    logger.error(parsed.error, `Failed to parse content ${stepsUrl}`);
    return null;
  }

  for (const packageDir of parsed.data.filter((element) => element.type === 'dir')) {
    const releases: Release[] = []

    const response = await client.getJson(packageDir.url )
    const parsed = GithubDirectoryResponse.safeParse(response.body)
    if (!parsed.success) {
      logger.error(parsed.error, `Failed to parse content ${packageDir.url}`);
      continue
    }


    for (const versionFile of parsed.data.filter(element => semver.isValid(element.name))) {
      const stepUrl = joinUrlParts(baseUrl, versionFile.path, "step.yml")
      const file = await client.get(stepUrl, {headers: {
          "Accept": "application/vnd.github.raw+json"
        }});


      const fileParsed =  parseSingleYaml(file.body, {
        customSchema: BitriseStepFile
      })


      releases.push({
        version: versionFile.name,
      })
      logger.info(response)
    }
    result[packageDir.name] = releases;
  }

  return result;
}
