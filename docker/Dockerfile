FROM node:8.10.0-alpine

LABEL maintainer="Rhys Arkins <rhys@arkins.net>"
LABEL name="renovate"

WORKDIR /src

COPY package.json .
COPY yarn.lock .
RUN yarn install --production && yarn cache clean
COPY lib ./lib
RUN chown -R node:node /src
USER node

ENTRYPOINT ["node", "/src/lib/renovate.js"]
CMD ["--help"]
