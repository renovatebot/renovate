import ignore from 'ignore';
import { logger } from '../../../../logger';
import type { Pr } from '../../../../modules/platform';
import { readLocalFile } from '../../../../util/fs';
import { getBranchFiles } from '../../../../util/git';
import { newlineRegex, regEx } from '../../../../util/regex';

interface FileOwnerRule {
  usernames: string[];
  pattern: string;
  score: number;
  match: (path: string) => boolean;
}

function extractOwnersFromLine(line: string): FileOwnerRule {
  const [pattern, ...usernames] = line.split(regEx(/\s+/));
  const matchPattern = ignore().add(pattern);
  return {
    usernames,
    pattern,
    score: pattern.length,
    match: (path: string) => matchPattern.ignores(path),
  };
}

interface UserScore {
  username: string;
  score: number;
}

interface FileScore {
  file: string;
  score: number;
}

interface FileOwnersScore {
  file: string;
  usernames: UserScore[];
}

function matchFileToOwners(
  file: string,
  rules: FileOwnerRule[]
): FileOwnersScore {
  const usersWithScore = rules
    .map((rule) =>
      rule.match(file) ? { score: rule.score, usernames: rule.usernames } : null
    )
    .reduce<UserScore[]>((acc, match) => {
      if (!match) {
        return acc;
      }
      for (const user of match.usernames) {
        if (!acc.find((a) => a.username === user)) {
          acc.push({ score: match.score, username: user });
        }
      }

      return acc;
    }, []);

  return { file, usernames: usersWithScore };
}

interface OwnerFileScore {
  username: string;
  files: FileScore[];
}

function getOwnerList(filesWithOwners: FileOwnersScore[]): OwnerFileScore[] {
  return filesWithOwners.reduce<OwnerFileScore[]>((acc, fileMatch) => {
    for (const userScore of fileMatch.usernames) {
      // Get / create user file score
      let userAcc = acc.find((u) => u.username === userScore.username);
      if (!userAcc) {
        userAcc = {
          username: userScore.username,
          files: [],
        };
        acc.push(userAcc);
      }

      // Add file to user
      let file = userAcc.files.find((f) => f.file === fileMatch.file);
      if (!file) {
        file = {
          file: fileMatch.file,
          score: 0,
        };
        userAcc.files.push(file);
      }
      file.score += userScore.score;
    }
    return acc;
  }, []);
}

export async function codeOwnersForPr(pr: Pr): Promise<string[]> {
  logger.debug('Searching for CODEOWNERS file');
  try {
    // Find CODEOWNERS file
    const codeOwnersFile =
      (await readLocalFile('CODEOWNERS', 'utf8')) ??
      (await readLocalFile('.github/CODEOWNERS', 'utf8')) ??
      (await readLocalFile('.gitlab/CODEOWNERS', 'utf8')) ??
      (await readLocalFile('docs/CODEOWNERS', 'utf8'));

    if (!codeOwnersFile) {
      logger.debug('No CODEOWNERS file found');
      return [];
    }

    logger.debug(`Found CODEOWNERS file: ${codeOwnersFile}`);

    // Get list of modified files in PR
    const prFiles = await getBranchFiles(pr.sourceBranch);

    if (!prFiles?.length) {
      logger.debug('PR includes no files');
      return [];
    }

    // Convert CODEOWNERS file into list of matching rules
    const fileOwnerRules = codeOwnersFile
      .split(newlineRegex)
      // Remove empty and commented lines
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      // Extract pattern & usernames
      .map(extractOwnersFromLine);

    logger.debug(
      { prFiles, fileOwnerRules },
      'PR files and rules to match for CODEOWNERS'
    );

    // Apply rules & get list of owners for each prFile
    const emptyRules = fileOwnerRules.filter(
      (rule) => rule.usernames.length === 0
    );
    const fileOwners =
      // Map through all prFiles and match said file(s) with all the rules
      prFiles
        .map((file) => matchFileToOwners(file, fileOwnerRules))

        // Match file again but this time only with emptyRules, to ensure that files which have no owner set remain owner-less
        .map((fileMatch) => {
          const matchEmpty = emptyRules.find((rule) =>
            rule.match(fileMatch.file)
          );
          if (matchEmpty) {
            return { ...fileMatch, usernames: [] };
          }
          return fileMatch;
        });

    logger.debug(
      `CODEOWNERS matched the following files: ${JSON.stringify(fileOwners)}`
    );

    // Get list of all matched users and the files they own (reverse keys of fileOwners)
    const usersWithOwnedFiles = getOwnerList(fileOwners);

    // Calculate a match score for each user. This allows sorting of the final user array in a way that guarantees that users matched with more precise patterns are first and users matched with less precise patterns are last (wildcards)
    const userScore = usersWithOwnedFiles
      .map((userMatch) => ({
        user: userMatch.username,
        score: userMatch.files.reduce((acc, file) => acc + file.score, 0),
      }))
      .sort((a, b) => b.score - a.score);

    logger.debug(
      `CODEOWNERS matched the following users: ${JSON.stringify(userScore)}`
    );

    return userScore.map((u) => u.user);
  } catch (err) {
    logger.warn({ err, pr }, 'Failed to determine CODEOWNERS for PR.');
    return [];
  }
}
