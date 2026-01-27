#!/bin/bash

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Uso: ./release.sh 1.0.0"
  exit 1
fi

echo "🚀 Criando release v$VERSION"

# Atualiza manifest.json se existir
if [ -f manifest.json ]; then
  sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" manifest.json
fi

# Atualiza package.json se existir
if [ -f package.json ]; then
  sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
fi

# Changelog simples
echo -e "\n## v$VERSION - $(date '+%Y-%m-%d')" >> CHANGELOG.md
git log --pretty=format:"- %s" $(git describe --tags --abbrev=0 2>/dev/null)..HEAD >> CHANGELOG.md || true

git add .
git commit -m "release: v$VERSION"

git tag v$VERSION

git push origin main
git push origin v$VERSION

echo "✅ Release v$VERSION criada com sucesso"
