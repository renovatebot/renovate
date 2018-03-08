
FROM node:8-alpine
WORKDIR /usr/src/app/
COPY package.json .
COPY yarn.lock .
RUN yarn install --production && yarn cache clean
COPY lib ./lib
RUN chown -R node:node /usr/src/app
USER node
ENTRYPOINT ["node", "/usr/src/app/lib/renovate.js"]
