import {
  BatchGetBuildsCommand,
  CodeBuildClient,
  ListBuildsCommand,
  ListBuildsCommandOutput,
} from '@aws-sdk/client-codebuild';
import type { Credentials } from '@aws-sdk/types';

let codeBuild: CodeBuildClient;

export function initCodeBuildClient(
  region: string,
  credentials: Credentials
): CodeBuildClient {
  if (!codeBuild) {
    codeBuild = new CodeBuildClient({
      region: region,
      credentials: credentials,
    });
  }
  return codeBuild;
}

export async function codeBuildTestFunctionality(): Promise<ListBuildsCommandOutput> {
  const cmd = new ListBuildsCommand({});
  const listBuildsCommandOutput = await codeBuild.send(cmd);
  const id = listBuildsCommandOutput.ids![0];
  const cmdsec = new BatchGetBuildsCommand({ ids: [id] });
  const someOutput = await codeBuild.send(cmdsec);
  return someOutput;
}
