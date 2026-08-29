# No native modules to compile (node:sqlite is built into Node itself --
# the reason this project avoided better-sqlite3 in the first place), so a
# single stage on a slim image is enough; there's no build step to isolate
# from the runtime image.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

# SQLite's file lives here. Mount a persistent volume at this path in
# production -- see DEPLOYMENT.md -- or every deploy/restart silently
# resets all user data on platforms with an ephemeral filesystem.
ENV DB_PATH=/app/data/app.sqlite
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", "--experimental-sqlite", "src/server.js"]
