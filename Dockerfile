FROM node:lts-slim
ENV TINI_VERSION v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

ENV NODE_ENV production

WORKDIR /usr/src/app
COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile
COPY . .

USER node
EXPOSE 5000
CMD ["/usr/src/app/node_modules/.bin/ts-node", "src/index.ts"]