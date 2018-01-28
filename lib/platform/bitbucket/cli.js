const parseDiff = require('parse-diff');
const api = require('./bb-got');
const R = require('./nanoramda');

const fn = p => p
  .then(R.prop('body'))
  .then(R.pipe(
    parseDiff,
    R.map(R.prop('chunks')),
    R.unnest,
    R.map(R.prop('changes')),
    R.unnest,
    R.filter(R.propEq('content', '+=======')),
    R.length,
    x => x > 0,
  ))
  // .then(R.prop('id'))
  .then(R.debug)
  .catch(R.err);

// const opts = {
  // headers: { Authorization: `Basic ${process.env.BB_TOKEN}` },
  // token: undefined,
// };

const config = {
  // repoName: 'FilipStenbeck1/testing',
  repoName: 'iamstarkov/nordnet-ui-kit',
}

const prNo = 28;
const branchName = 'master';
const filePath = 'README.md';



const FormData = require('form-data');
const form = new FormData();

form.append('message', 'CLI COMMIT MOVE ALONG, NOTHING TO SEE HERE');
form.append('parents', 'e45b36d772f992ba140b472ffa596a7e1b7cb2c6');

form.append('branch',  'renovate/enzyme-3.x');
form.append('/README.md',  `test thingy`);
form.append('/README yolo.md',  `yolo`);

console.log(form)
// message: 'CLI COMMIT MOVE ALONG, NOTHING TO SEE HERE',
// parents: '4c19bab47b9f176ac3d3f775b95cc6174a619a02',
// files: [
//   `/README.md='yolo'`
//   // `/README2.md='yolo2'`
//   // `/README2.md='yolo2'`
// ],
// branch: 'CLI-CREATED-BRANCH-2',
fn(
  // api.get(`/2.0/repositories/iamstarkov/nordnet-ui-kit`, opts),
  // api.get(`/2.0/repositories/FilipStenbeck1/testing/pullrequests/1`, opts)
  // api.get(`/2.0/repositories/${config.repoName}/pullrequests/${prNo}/diff`, { ...opts, json: false })
  /*
  api.post(`/2.0/repositories/${config.repoName}/pullrequests/${prNo}/merge`, {
    ...opts,
    token: undefined,
    body: {
      close_source_branch: true,
      merge_strategy: 'merge_commit',
      message: 'auto merged',
    }
  })
  */
  // api.get(`/2.0/repositories/${config.repoName}/src/${branchName}/${filePath}`, { json: false }),

  api.post(`/2.0/repositories/${config.repoName}/src`, { json: false, body: form })
  // api.get( `/2.0/repositories/${config.repoName}/refs/branches/${branchName}` )

  // api.get( `/2.0/repositories/${config.repoName}/pullrequests/${prNo}/diff`, { json: false } )
)
