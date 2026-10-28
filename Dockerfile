FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY dashboard ./dashboard
COPY assets/fonts ./assets/fonts
RUN npm run build

FROM node:20-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /usr/src/app/dist ./dist
COPY lavalink ./lavalink
# Welcome card fonts (the bot registers them from ../../assets/fonts relative to dist/services).
COPY assets/fonts ./assets/fonts
# Walnut for the bot's event banner (services/cosmetics/botProfile.ts reads it relative to dist).
COPY dashboard/src/assets/wood/walnut.webp ./dashboard/src/assets/wood/walnut.webp

EXPOSE 3000

CMD ["node", "dist/app.js"]
