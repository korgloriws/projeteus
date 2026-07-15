# ProjetEUs

Sistema de gestão de projetos que conecta uma empresa contratada e um ente público na execução conjunta de projetos: etapas, tarefas, papéis de acesso e comunicação entre as duas partes.

## Stack local

- **Frontend:** React 19 + Vite + TanStack Query + wouter + shadcn/ui
- **Backend:** Node.js + Express 5
- **Banco:** SQLite (arquivo local) + Drizzle ORM
- **Auth:** sessão local com cookie httpOnly + JWT (sem serviços externos)

## Pré-requisitos

- Node.js 24+
- npm

Não é necessário instalar servidor de banco — os dados ficam em `data/projeteus.db`.

## Configuração

Entre na pasta do app e configure o ambiente:

```bash
cd projeteus
cp .env.example .env
npm install
npm run db:push
npm run db:seed
```

O seed apaga todos os dados e cria apenas o usuário **admin** inicial (configurável no `.env`):

| Variável | Default |
|---|---|
| `SEED_ADMIN_EMAIL` | `mateus@projeteus.local` |
| `SEED_ADMIN_NAME` | `Mateus` |
| `SEED_ADMIN_PASSWORD` | `projeteus` |

Para zerar o banco de novo: `npm run db:seed`

## Desenvolvimento

Em terminais separados, dentro de `projeteus/`:

```bash
npm run dev:api   # API Express em http://localhost:8080
npm run dev:web   # Frontend Vite em http://localhost:5173
```

O Vite faz proxy de `/api` para a API local.

## Scripts úteis

- `npm run typecheck` — verificação de tipos
- `npm run build` — build do frontend e da API
- `npm run codegen` — regenera hooks React Query e schemas Zod a partir do OpenAPI

## Estrutura

```
projeteus/
├── src/           # frontend React
├── server/        # API Express
├── db/            # Drizzle ORM (schema + seed)
├── api/           # cliente gerado (Orval) + custom-fetch
├── openapi.yaml   # contrato da API
└── orval.config.ts
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Não | Caminho do SQLite (default: `file:./data/projeteus.db`) |
| `SESSION_SECRET` | Sim | Segredo para assinar cookies de sessão |
| `WEB_PORT` | Não | Porta do frontend (default: `5173`) |
| `WEB_ORIGIN` | Não | Origem do frontend (default: `http://localhost:5173`) |
| `PORT` | Não | Porta da API (default: `8080`) |
| `SEED_ADMIN_EMAIL` | Não | E-mail do admin inicial (seed) |
| `SEED_ADMIN_NAME` | Não | Nome do admin inicial (seed) |
| `SEED_ADMIN_PASSWORD` | Não | Senha do admin inicial (seed) |

## Deploy com Docker (VPS)

Em produção, **um único container Node** builda e serve o front-end (SPA) **e** a API
na mesma porta (`8080`). Na frente, o **Caddy** funciona como reverse proxy com
**HTTPS automático** (Let's Encrypt) — isso é necessário porque o cookie de sessão é
`secure` em produção (só trafega por HTTPS).

Arquivos de infra (na raiz de `projeteus/`):

- `Dockerfile` — builda front + API e roda migração de schema no start
- `docker-compose.yml` — orquestra `app` + `caddy` com volumes persistentes
- `Caddyfile` — reverse proxy + TLS automático
- `.env.production.example` — modelo das variáveis de produção

### 1) Subir o projeto para o GitHub (na máquina local)

```bash
cd projeteus
git init
git add .
git commit -m "Deploy inicial com Docker"
git branch -M main
git remote add origin https://github.com/korgloriws/projeteus.git
git push -u origin main
```

> O `.gitignore` já garante que `.env`, `data/` e `node_modules/` **não** vão para o repositório.

### 2) Preparar a VPS (Ubuntu 24.04 com Docker)

Acesse via SSH (`ssh root@31.97.167.75`). O plano da Hostinger já vem com Docker;
confirme com `docker --version` e `docker compose version`. Abra as portas 80 e 443:

```bash
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
```

### 3) Clonar e configurar

```bash
git clone https://github.com/korgloriws/projeteus.git
cd projeteus
cp .env.production.example .env
# edite o .env e defina um SESSION_SECRET forte:
#   sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$(openssl rand -hex 32)|" .env
nano .env
```

No `Caddyfile`, confirme que o domínio aponta para a VPS. O hostname
`srv1176791.hstgr.cloud` deve resolver para `31.97.167.75` (ou troque por um domínio próprio).

### 4) Subir a aplicação

```bash
docker compose up -d --build
```

O container roda `db:push` automaticamente (cria/atualiza o schema) e sobe a app.
Crie o **admin inicial** (uma única vez — o seed apaga os dados!):

```bash
docker compose exec app npm run db:seed
```

Acesse: **https://srv1176791.hstgr.cloud**

### Comandos do dia a dia

```bash
docker compose logs -f app        # logs da aplicação
docker compose logs -f caddy      # logs do proxy / TLS
docker compose ps                 # status dos containers
docker compose restart app        # reiniciar só a app
docker compose down               # parar tudo (dados ficam nos volumes)
```

### Atualizar após novas mudanças

```bash
git pull
docker compose up -d --build
```

Os dados persistem no volume `projeteus_data` (SQLite) e os certificados TLS no
volume `caddy_data`, então rebuilds **não** apagam nada.
