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
COPY scripts ./scripts
EXPOSE 8080 4174
CMD ["node", "start.js"]
