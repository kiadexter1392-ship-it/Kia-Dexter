# Compile the standalone React demo during image build; runtime remains Node-only.
FROM node:22-bookworm-slim AS gooey-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY components ./components
COPY lib ./lib
COPY gooey-demo ./gooey-demo
COPY vite.config.mts tsconfig.gooey.json ./
RUN npm run check:gooey && npm run build:gooey

# Explicit web runtime: the Android project also lives in this repository.
# Do not rely on auto-detection choosing Node instead of Gradle.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY start.js ./
COPY coach ./coach
COPY members ./members
COPY shared ./shared
COPY --from=gooey-build /app/shared/public/gooey-demo ./shared/public/gooey-demo
COPY scripts ./scripts
EXPOSE 8080 4174
CMD ["node", "start.js"]
