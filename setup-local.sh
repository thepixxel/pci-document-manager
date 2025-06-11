#!/bin/bash

echo "🚀 Iniciando entorno local para pci-document-manager..."

# Obtener el path base del proyecto
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$BASE_DIR/server"
CLIENT_DIR="$BASE_DIR/client"
ENV_FILE="$SERVER_DIR/.env"
ENV_EXAMPLE_FILE="$SERVER_DIR/.env.example"

# Paso 0: Verificar que .env exista (o copiarlo desde .env.example)
if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE_FILE" ]; then
        echo "📄 Copiando .env desde .env.example..."
        cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
    else
        echo "❌ ERROR: No se encontró .env ni .env.example. Abortando."
        exit 1
    fi
fi

# Paso 0.1: Verificar que OPENAI_API_KEY esté definida
OPENAI_KEY=$(grep "^OPENAI_API_KEY=" "$ENV_FILE" | cut -d '=' -f2)

if [ -z "$OPENAI_KEY" ]; then
    echo "⚠️  ADVERTENCIA: La variable OPENAI_API_KEY está vacía. Algunas funciones no funcionarán."
elif [[ "$OPENAI_KEY" == "dummy_test_key" ]]; then
    echo "🔒 Usando una clave de OpenAI dummy. Procesamiento con IA estará inactivo (modo desarrollo)."
else
    echo "✅ Clave de OpenAI detectada."
fi

# Paso 1: Verificar e instalar MongoDB si no está
if ! command -v mongod &> /dev/null; then
    echo "📦 MongoDB no está instalado. Instalando MongoDB Community Edition..."
    brew tap mongodb/brew
    brew install mongodb-community
else
    echo "✅ MongoDB ya está instalado."
fi

# Paso 2: Iniciar MongoDB como servicio
echo "▶️ Iniciando servicio MongoDB..."
brew services start mongodb-community

# Paso 3: Instalar dependencias del backend
echo "📦 Instalando dependencias del backend..."
cd "$SERVER_DIR"
npm install

# Paso 4: Instalar dependencias del frontend
echo "📦 Instalando dependencias del frontend..."
cd "$CLIENT_DIR"
npm install

# Paso 5: Iniciar backend y frontend en nuevas terminales
echo "🚀 Iniciando backend y frontend en nuevas terminales..."

osascript -e "tell application \"Terminal\"
    do script \"cd '$SERVER_DIR' && npm start\"
end tell"

osascript -e "tell application \"Terminal\"
    do script \"cd '$CLIENT_DIR' && npm start\"
end tell"

echo "✅ Todo listo. Accede a:"
echo "🌐 Frontend: http://localhost:3000"
echo "🛠️ Backend API: http://localhost:5000"