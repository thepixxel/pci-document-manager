#!/bin/bash

# ---------------- CONFIGURACIÓN ----------------
REPO_NAME="pci-document-manager"
GITHUB_USER="thepixxel"               # Cambia si es diferente
PRIVATE=true                          # true = privado, false = público
DEFAULT_BRANCH="main"
TAG_VERSION="v1.0.0"
# ------------------------------------------------

stop_on_error() {
  echo "❌ Error: $1"
  exit 1
}

confirm() {
    read -p "❓ $1 (y/n): " choice
    case "$choice" in 
      y|Y ) return 0 ;;
      * ) return 1 ;;
    esac
}

PROJECT_DIR=$(pwd)
echo "📁 Proyecto: $PROJECT_DIR"

# 🔧 Inicializar Git si no está
if [ ! -d ".git" ]; then
  echo "🔧 Inicializando repositorio Git..."
  git init || stop_on_error "No se pudo inicializar Git"
else
  echo "✅ Git ya está inicializado."
fi

# 🛡️ Crear .gitignore si no existe
if [ ! -f ".gitignore" ]; then
  echo "🛡️  Generando .gitignore..."
  cat <<EOL > .gitignore
node_modules/
build/
dist/
.env
.env.*
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
.vscode/
EOL
fi

# 📄 Crear README.md si no existe
if [ ! -f "README.md" ]; then
  echo "# $REPO_NAME" > README.md
  echo "📝 README.md generado."
fi

# 📦 Verificar si hay archivos sin trackear
CHANGES=$(git status --porcelain)
if [ -z "$CHANGES" ]; then
  echo "⚠️  No hay archivos nuevos o cambios para hacer commit."
else
  confirm "¿Deseas hacer commit de los cambios actuales?" && {
    git add .
    git commit -m "Primer commit - proyecto PCI Document Manager" || echo "⚠️  No se hizo commit (posiblemente ya existía o sin cambios)."
  }
fi

# 🌐 Verificar si repo remoto ya existe
echo "🔍 Verificando si el repositorio existe en GitHub..."
if gh repo view "$GITHUB_USER/$REPO_NAME" > /dev/null 2>&1; then
  echo "ℹ️  El repositorio $REPO_NAME ya existe en GitHub."
else
  echo "🚀 Creando repositorio en GitHub..."
  if [ "$PRIVATE" = true ]; then
    gh repo create "$GITHUB_USER/$REPO_NAME" --private --source=. --remote=origin || stop_on_error "No se pudo crear el repo remoto"
  else
    gh repo create "$GITHUB_USER/$REPO_NAME" --public --source=. --remote=origin || stop_on_error "No se pudo crear el repo remoto"
  fi
fi

# 🌿 Rama principal
git branch -M "$DEFAULT_BRANCH"

# 🚀 Push
confirm "¿Deseas hacer push al repositorio remoto?" && {
  git push -u origin "$DEFAULT_BRANCH" || echo "⚠️  Ya está actualizado o sin cambios nuevos."
}

# 🏷️ Crear tag v1.0.0 si no existe
if ! git tag | grep -q "$TAG_VERSION"; then
  echo "🏷️  Creando tag inicial $TAG_VERSION..."
  git tag "$TAG_VERSION"
  git push origin "$TAG_VERSION"
  echo "✅ Tag $TAG_VERSION creado y enviado."
else
  echo "ℹ️  El tag $TAG_VERSION ya existe. No se creó de nuevo."
fi

# ✅ Fin
echo "🎉 Repositorio y tag inicial listos:"
echo "🔗 https://github.com/$GITHUB_USER/$REPO_NAME"