# PCI Document Manager

Una herramienta web para la gestión, revisión y seguimiento de documentos de cumplimiento PCI DSS para el registro de comercios en las marcas.

## Características Principales

- **Gestión de Documentos**: Carga, almacenamiento y organización de documentos PCI (AOC, SAQ, etc.)
- **Extracción Automática**: Análisis de documentos mediante IA para extraer información clave
- **Validación de Cumplimiento**: Verificación automática de criterios de cumplimiento PCI
- **Seguimiento de Vencimientos**: Monitoreo de fechas de vencimiento y notificaciones automáticas
- **Dashboard Intuitivo**: Interfaz amigable para usuarios no técnicos
- **Integración con Repositorios**: Conexión con Google Drive, SharePoint, Dropbox
- **Notificaciones**: Alertas por correo electrónico y Slack
- **Búsqueda Avanzada**: Filtrado y búsqueda de documentos por múltiples criterios
- **Reportes**: Generación de informes y exportación de datos

## Tecnologías

- **Frontend**: React.js
- **Backend**: Node.js con Express
- **Base de Datos**: MongoDB
- **Integración IA**: OpenAI API
- **Autenticación**: JWT
- **Almacenamiento**: Integración con servicios cloud

## Estructura del Proyecto

```
pci-document-manager/
├── client/                 # Frontend React
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── utils/
├── server/                 # Backend Node.js
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── services/
└── README.md
```

## Instalación y Configuración

### Requisitos Previos
- Node.js (v14 o superior)
- MongoDB
- Cuenta de OpenAI API (para extracción de documentos)
- Cuentas de servicios de almacenamiento (Google Drive, Dropbox, etc.)

### Pasos de Instalación
1. Clonar el repositorio
2. Instalar dependencias del servidor: `cd server && npm install`
3. Instalar dependencias del cliente: `cd client && npm install`
4. Configurar variables de entorno (ver `.env.example`)
5. Iniciar el servidor: `cd server && npm start`
6. Iniciar el cliente: `cd client && npm start`

## Uso

[Instrucciones detalladas de uso se agregarán en futuras versiones]

## Roadmap

- **Fase 1**: MVP con funcionalidades básicas de carga y extracción
- **Fase 2**: Implementación de validaciones y notificaciones
- **Fase 3**: Integración con repositorios externos y mejoras en la UI
- **Fase 4**: Funcionalidades avanzadas de reportes y análisis

## Licencia

[Tipo de licencia a definir]

## Contacto

[Información de contacto a definir]