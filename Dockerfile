FROM node:15

WORKDIR /app

CMD [ -d "node_modules" ] && npm run build && npm run start || npm ci && npm run build && npm run start
