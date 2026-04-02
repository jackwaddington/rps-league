FROM node:22-alpine
# Required to compile better-sqlite3 native addon
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["npm", "run", "server"]
