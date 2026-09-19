FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 AI_PROVIDER=local
WORKDIR /app
COPY --chown=node:node package.json server.mjs ./
COPY --chown=node:node lib/ ./lib/
COPY --chown=node:node public/ ./public/
COPY --chown=node:node data/ ./data/
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
