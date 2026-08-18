FROM node:20-slim

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm install

COPY client/package*.json ./client/
RUN cd client && npm install

COPY . .

RUN cd client && npm run build
RUN cd server && npm run build

EXPOSE 8080

CMD ["sh", "-c", "mkdir -p /app/server/data && cd server && node dist/index.js"]
