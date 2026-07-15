# ProjetEUs — imagem única que builda e serve front (SPA) + API na mesma porta.
# Base Debian (glibc) para compatibilidade com o binário nativo do @libsql/client.
FROM node:24-bookworm-slim

WORKDIR /app

# 1) Instala TODAS as dependências (dev incluídas): necessárias para o build
#    (vite/esbuild) e para a migração de schema em runtime (tsx/drizzle-kit).
COPY package.json package-lock.json ./
RUN npm ci

# 2) Copia o código-fonte (respeitando o .dockerignore).
COPY . .

# 3) Builda o front (dist/public) e a API (server/dist/index.mjs).
RUN npm run build

# 4) Ambiente de produção.
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Migração de schema + start da aplicação.
RUN chmod +x /app/docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]
