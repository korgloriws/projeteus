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
na mesma origem. O container é exposto **diretamente numa porta do host** (mesmo padrão
dos outros sistemas da VPS, ex.: `http://31.97.167.75:3020`).

Arquivos de infra (na raiz de `projeteus/`):

- `Dockerfile` — builda front + API e roda migração de schema no start
- `docker-compose.yml` — sobe o container com volume persistente para o SQLite
- `.env.production.example` — modelo das variáveis de produção

> **Cookie de sessão e HTTP:** o cookie `secure` exige HTTPS. Como o acesso aqui é por
> HTTP numa porta, mantenha `COOKIE_SECURE=false` no `.env` para o login funcionar.
> Se um dia colocar HTTPS (reverse proxy/domínio) na frente, mude para `COOKIE_SECURE=true`.

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
confirme com `docker --version` e `docker compose version`. Libere a porta escolhida
(ex.: `3020`) no firewall (se o `ufw` estiver ativo):

```bash
ufw allow 3020
```

### 3) Clonar e configurar

```bash
mkdir -p /opt/projeteus && cd /opt/projeteus
git clone https://github.com/korgloriws/projeteus.git .
cp .env.production.example .env
sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$(openssl rand -hex 32)|" .env
nano .env
```

No `.env`, ajuste principalmente:

- `APP_PORT` — porta pública (default `3020`; use uma livre na VPS)
- `SESSION_SECRET` — já preenchido com valor aleatório pelo comando acima
- `WEB_ORIGIN` — `http://31.97.167.75:<APP_PORT>`
- `COOKIE_SECURE=false` (acesso por HTTP)

### 4) Subir a aplicação

```bash
docker compose up -d --build
```

O container roda `db:push` automaticamente (cria/atualiza o schema) e sobe a app.
Crie o **admin inicial** (uma única vez — o seed apaga os dados!):

```bash
docker compose exec app npm run db:seed
```

Acesse: **http://31.97.167.75:3020** (ou a porta que definiu em `APP_PORT`).

### Comandos do dia a dia

```bash
docker compose logs -f app        # logs da aplicação
docker compose ps                 # status do container
docker compose restart app        # reiniciar a app
docker compose down               # parar (dados ficam no volume)
```

### Atualizar após novas mudanças

```bash
git pull
docker compose up -d --build
```

Os dados persistem no volume `projeteus_data` (SQLite), então rebuilds **não** apagam nada.
