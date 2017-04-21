/* eslint-disable no-console */
const http = require('http');

const port = process.env.PORT || '3000';

const requestHandler = (request, response) => {
  // Redirect users to Heroku dashboard
  const appName = request.headers.host.split(':')[0].split('.')[0];
  response.writeHead(302, {
    Location: `https://dashboard.heroku.com/apps/${appName}/logs`,
  });
  response.end();
};

http.createServer(requestHandler).listen(port, err => {
  if (err) {
    console.log('Failed to start web server', err);
    return;
  }
  console.log(`Web server is listening on ${port}`);
});
