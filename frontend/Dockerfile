FROM node:22-slim AS build
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# Full copy keeps next.config.ts loadable at runtime (needs typescript from devDependencies).
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
# BACKEND_URL is read at request time by the server-side proxy; the browser never sees it.
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
