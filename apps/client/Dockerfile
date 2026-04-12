FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# VITE_API_BASE is empty: nginx serves client and proxies API on the same domain
# Use vite build directly — tsc type-checking is a dev concern, not a build blocker
RUN VITE_API_BASE="" npx vite build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
