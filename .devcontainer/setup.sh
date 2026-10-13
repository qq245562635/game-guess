#!/usr/bin/env bash
# One-time setup for Codespaces / Dev Containers: env file, deps, database, dev seed.
set -euo pipefail

if [ ! -f .env ]; then
  secret=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
  cat > .env <<EOF
DATABASE_URL="postgresql://gg:gg@localhost:5432/gameguess"
SHADOW_DATABASE_URL="postgresql://gg:gg@localhost:5432/gameguess_shadow"
SESSION_SECRET="$secret"
EOF
  echo "Created .env with a random SESSION_SECRET"
fi

npm install --no-audit --no-fund
npm run db:generate

echo "Waiting for PostgreSQL..."
for _ in $(seq 1 30); do
  node -e "require('net').connect(5432,'localhost').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))" && break
  sleep 2
done

npm run db:migrate
npm run db:seed
echo "Setup complete. The site starts with: npm run dev"
