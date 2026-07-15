#!/usr/bin/env sh
set -e

# Sincroniza o schema do SQLite (idempotente) contra o banco no volume /app/data.
echo "[entrypoint] Sincronizando schema do banco (db:push)..."
npm run db:push

# Sobe a API + front-end (mesma porta).
echo "[entrypoint] Iniciando ProjetEUs na porta ${PORT:-8080}..."
exec npm run start:api
