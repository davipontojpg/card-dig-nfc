#!/usr/bin/env bash
set -euo pipefail

PG_BIN="/usr/lib/postgresql/16/bin"
if [[ ! -x "${PG_BIN}/initdb" ]]; then
  echo "Erro: binários do PostgreSQL 16 não encontrados em ${PG_BIN}." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d /tmp/card-dig-nfc-pg16-XXXXXX)"
DATA_DIR="${TMP_DIR}/data"
SOCKET_DIR="${TMP_DIR}/sock"
LOG_FILE="${TMP_DIR}/postgres.log"
DB_NAME="menuflow_test"

cleanup() {
  set +e
  if [[ -d "${DATA_DIR}" ]]; then
    "${PG_BIN}/pg_ctl" -D "${DATA_DIR}" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

mkdir -p "${SOCKET_DIR}"

echo "[1/4] Inicializando instância efêmera PostgreSQL 16..."
"${PG_BIN}/initdb" -D "${DATA_DIR}" -U postgres -A trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null

echo "[2/4] Iniciando PostgreSQL 16 (somente Unix socket local)..."
"${PG_BIN}/pg_ctl" -D "${DATA_DIR}" -l "${LOG_FILE}" -o "-k ${SOCKET_DIR} -c listen_addresses='' -c log_min_messages=warning" start >/dev/null

PSQL_CMD=("${PG_BIN}/psql" -h "${SOCKET_DIR}" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL_CMD[@]}" -d postgres -c "CREATE DATABASE ${DB_NAME};"

echo "[3/4] Criando shims Supabase (roles anon/authenticated/service_role, schemas auth & storage)..."
"${PSQL_CMD[@]}" -d "${DB_NAME}" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '');
$$;

CREATE SCHEMA IF NOT EXISTS storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL REFERENCES storage.buckets(id),
  name text NOT NULL,
  owner uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_id, name)
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;
GRANT SELECT ON storage.buckets TO anon, authenticated;

CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_parts text[];
BEGIN
  v_parts := string_to_array(name, '/');
  IF array_length(v_parts, 1) IS NULL OR array_length(v_parts, 1) <= 1 THEN
    RETURN ARRAY[]::text[];
  END IF;
  RETURN v_parts[1 : array_length(v_parts, 1) - 1];
END;
$$;
SQL

echo "[4/4] Aplicando migrations e executando suíte de testes SQL/RLS..."
for f in supabase/migrations/*.sql; do
  echo "  -> Aplicando $f"
  "${PSQL_CMD[@]}" -d "${DB_NAME}" -f "$f"
done

echo "  -> Executando supabase/tests/rls_and_business_rules.sql"
"${PSQL_CMD[@]}" -d "${DB_NAME}" -f supabase/tests/rls_and_business_rules.sql

echo "  -> Validando sintaxe e execução de supabase/seed.sql (em transação revertida)"
"${PSQL_CMD[@]}" -d "${DB_NAME}" -c "BEGIN;" -f supabase/seed.sql -c "ROLLBACK;"

echo "Suíte PostgreSQL 16 + RLS concluída com 100% de sucesso."
