#!/usr/bin/env bash
set -e
if [ -z "$DATABASE_URL" ]; then
  echo "Please set DATABASE_URL env var"
  exit 1
fi
psql "$DATABASE_URL" -f migrations/001_create_tables.sql