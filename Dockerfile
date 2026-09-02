FROM node:20-alpine
WORKDIR /app
COPY static-build ./static-build
COPY dist ./dist
COPY server ./server
COPY package.json ./
ENV NODE_ENV=production
ENV PORT=8080
ENV BASE_PATH=""
EXPOSE 8080
CMD ["node", "server/serve.js"]
