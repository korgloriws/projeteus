#!/usr/bin/env sh
set -e

# NÃO rode db:push aqui.
# O push do Drizzle pode recriar tabelas em mudanças de schema e apagar dados
# em produção. Schema só sob demanda, com backup, fora do start automático.

echo "[entrypoint] Iniciando ProjeTeus na porta ${PORT:-8080}..."
exec npm run start:api
