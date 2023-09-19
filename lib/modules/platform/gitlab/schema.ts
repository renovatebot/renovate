import { z } from 'zod';

export const GitlabCommit = z.object({
  id: z.string(),
  short_id: z.string(),
  title: z.string(),
  author_name: z.string(),
  author_email: z.string(),
  committer_name: z.string(),
  committer_email: z.string(),
  created_at: z.string(),
  message: z.string(),
  committed_date: z.string(),
  authored_date: z.string(),
  parent_ids: z.array(z.string()),
  last_pipeline: z.nullable(
    z.object({
      id: z.number(),
      ref: z.string(),
      sha: z.string(),
      status: z.string(),
    })
  ),
  status: z.nullable(z.string()),
  web_url: z.string(),
});
