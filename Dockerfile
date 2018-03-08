
FROM node:8-alpine as dependencies
WORKDIR /usr/src/app/
COPY package.json .
COPY yarn.lock .
RUN yarn install --production

FROM node:8-alpine
WORKDIR /usr/src/app/
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY package.json .
COPY lib ./lib
RUN chown -R node:node /usr/src/app
USER node
ENTRYPOINT ["node", "/usr/src/app/lib/renovate.js"]
