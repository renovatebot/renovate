/* eslint-disable no-console */
const http = require('http');

const port = process.env.PORT || '3000';

const requestHandler = (request, response) => {
  // Redirect users to Heroku scheduler dashboard
  response.writeHead(302, { Location: 'https://scheduler.heroku.com/dashboard' });
  response.end();
};

http.createServer(requestHandler).listen(port, (err) => {
  if (err) {
    console.log('Failed to start web server', err);
    return;
  }
  console.log(`Web server is listening on ${port}`);
});
