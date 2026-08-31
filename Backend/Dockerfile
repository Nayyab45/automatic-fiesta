# No native modules to compile (mysql2 is pure JS), so a single stage on a
# slim image is enough; there's no build step to isolate from the runtime
# image. All state lives in the remote MySQL database (DB_HOST/etc in
# .env), so this container itself is stateless -- no volume needed, and any
# host works, including purely serverless/ephemeral ones.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 3000

CMD ["node", "src/server.js"]
