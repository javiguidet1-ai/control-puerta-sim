# 🔐 Puerta de Lobres — Sistema de Control de Acceso

Panel de gestión de 200 casilleros/posiciones con control por SMS via **httpSMS**.

---

## Arquitectura

```
puerta-de-lobres/
├── backend/               # Node.js + Express + SQLite
│   ├── src/
│   │   ├── db/
│   │   │   ├── database.js     # Setup SQLite + migraciones automáticas
│   │   │   └── seed.js         # Inicializa 200 casilleros
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT auth middleware
│   │   ├── routes/
│   │   │   ├── auth.js         # POST /auth/login
│   │   │   ├── casilleros.js   # CRUD casilleros
│   │   │   ├── sms.js          # Envío de SMS
│   │   │   ├── webhook.js      # Recepción de SMS entrantes
│   │   │   ├── auditoria.js    # Estadísticas y log
│   │   │   └── config.js       # Configuración del sistema
│   │   ├── services/
│   │   │   ├── httpsms.js      # Cliente API de httpSMS
│   │   │   └── smsProcessor.js # Lógica: "OK", "LISTA200", etc.
│   │   └── index.js            # Entry point Express
│   ├── data/                   # SQLite DB (creada automáticamente)
│   ├── .env.example
│   └── package.json
│
└── frontend/              # React 18 + Vite + Tailwind CSS
    ├── src/
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── Casilleros.jsx
    │   │   ├── CasilleroDetalle.jsx
    │   │   ├── SMS.jsx
    │   │   ├── Auditoria.jsx
    │   │   └── Configuracion.jsx
    │   ├── components/
    │   │   └── Layout.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── services/
    │   │   └── api.js          # Llamadas al backend
    │   └── App.jsx
    └── package.json
```

---

## Instalación rápida

### Requisitos previos
- Node.js 18+ (https://nodejs.org)
- Un móvil Android con la app **httpSMS** instalada

### 1. Instalar backend

```bash
cd backend
cp .env.example .env
# Editar .env con tus valores
npm install
npm start
```

El servidor arranca en `http://localhost:3001`.
Los 200 casilleros se inicializan automáticamente en el primer arranque.

### 2. Instalar frontend

```bash
cd frontend
npm install
npm run dev
```

El panel estará en `http://localhost:5173`.

### 3. Login inicial

- **Usuario:** `admin`
- **Contraseña:** `admin123`

> Cambiar en el archivo `.env` del backend (`ADMIN_USER` / `ADMIN_PASS`).

---

## Configuración de httpSMS

httpSMS convierte tu móvil Android en un gateway SMS real. Los mensajes se envían **desde tu número personal**, sin coste adicional por SMS (solo los de tu tarifa).

### Paso 1 — Instalar la app en Android

1. Descarga **httpSMS** desde Google Play Store o F-Droid
2. Ábrea y concede permisos de SMS
3. Inicia sesión o crea cuenta en https://httpsms.com

### Paso 2 — Obtener las credenciales

En https://httpsms.com:

| Dato | Dónde encontrarlo |
|------|-------------------|
| **API Key** | Settings → API Keys → Create new key |
| **Device ID** | Phones → tu teléfono → copiar ID |
| **Webhook** | Settings → Webhooks (ver más abajo) |

### Paso 3 — Configurar en el panel

Ve a **Configuración** en el panel y rellena:
- API Key de httpSMS
- Device ID del móvil
- Teléfono administrador (formato `+34XXXXXXXXX`)

### Paso 4 — Configurar el Webhook (SMS entrantes)

Para que el sistema detecte las respuestas "OK" y el código de auditoría, debes configurar el webhook:

1. En https://httpsms.com → **Settings → Webhooks → Add**
2. **URL:** `http://TU-IP-SERVIDOR:3001/webhook/sms`
3. **Event:** `message.phone.received`
4. Guardar

> Si el servidor no tiene IP pública, usa **ngrok** para exponer el puerto:
> ```bash
> ngrok http 3001
> # Usa la URL https://xxxx.ngrok.io/webhook/sms
> ```

### Paso 5 — Verificar

En el panel → Configuración → botón **"Probar SMS de prueba"**.
Si recibes el SMS en tu móvil, todo está funcionando.

---

## API REST — Endpoints

Todos los endpoints (excepto `/auth/login` y `/webhook/sms`) requieren el header:
```
Authorization: Bearer <token>
```

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/login` | Login con usuario/contraseña |
| POST | `/auth/verify` | Verifica si el token es válido |

### Casilleros
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/casilleros` | Lista con filtros: `?estado=ACTIVO&q=texto` |
| GET | `/casilleros/:id` | Detalle + historial + SMS |
| PUT | `/casilleros/:id` | Actualizar (guarda historial automáticamente) |
| GET | `/casilleros/export/csv` | Exportar a CSV |

### SMS
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/sms/enviar` | Envía un SMS libre |
| POST | `/sms/enviar-alta/:id` | SMS de alta al titular del casillero |
| GET | `/sms/registro` | Historial de SMS enviados/recibidos |
| GET | `/sms/pendientes` | Casilleros activos sin confirmación |

### Webhook (sin autenticación)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/webhook/sms` | Recibe SMS entrantes de httpSMS |
| GET | `/webhook/sms/test` | Verifica que el webhook está activo |

### Auditoría
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/auditoria/lista` | Snapshot de casilleros activos |
| GET | `/auditoria/log` | Log completo de actividad |
| GET | `/auditoria/stats` | Estadísticas del dashboard |

### Configuración
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/config` | Ver configuración (API keys enmascaradas) |
| PUT | `/config` | Actualizar configuración |
| POST | `/config/test-sms` | Enviar SMS de prueba |

---

## Funcionalidades del sistema SMS

### Confirmación "OK"
Cuando el titular de un casillero recibe el SMS de alta y responde **"OK"**:
- El sistema detecta el "OK" automáticamente vía webhook
- Marca el casillero como `sms_confirmado = true`
- Registra la fecha de confirmación

### Código de auditoría (LISTA200)
El administrador puede enviar el código (configurable) **desde su propio número** al mismo número:
- El sistema responde automáticamente con la lista de casilleros activos
- Se envía en bloques de 10 para no superar el límite de caracteres
- Solo funciona desde el número del administrador

### Flujo típico de alta de un casillero
1. Panel → Casilleros → Editar casillero N
2. Introducir nombre del titular y teléfono → Guardar
3. Cambiar estado a ACTIVO
4. Pulsar "💬 SMS" o ir al detalle → "Enviar SMS alta"
5. El titular recibe el SMS y responde "OK"
6. El sistema marca el casillero como confirmado

---

## Variables de entorno (`.env`)

```env
PORT=3001
JWT_SECRET=tu_secreto_muy_seguro
ADMIN_USER=admin
ADMIN_PASS=admin123
HTTPSMS_API_KEY=sk_xxxx
HTTPSMS_DEVICE_ID=uuid-del-dispositivo
ADMIN_PHONE=+34600000000
AUDIT_CODE=LISTA200
```

---

## Base de datos

SQLite, creada automáticamente en `backend/data/puerta_lobres.db`.

### Tablas
- **casilleros** — 200 posiciones con titular, teléfono, estado, código
- **historial_telefonos** — Registro de todos los cambios de teléfono/titular
- **log_actividad** — Auditoría de acciones del sistema
- **sms_registro** — Todos los SMS enviados y recibidos
- **configuracion** — Pares clave-valor para los ajustes del sistema

### Reglas de integridad
- Los casilleros **NUNCA se eliminan**, solo se marcan como INACTIVO
- Cada cambio de teléfono **siempre guarda el anterior** en `historial_telefonos`
- Todos los SMS quedan registrados en `sms_registro`

---

## Despliegue en servidor

Para un servidor Linux con Node.js:

```bash
# Instalar pm2 para gestión de procesos
npm install -g pm2

# Backend
cd backend
npm install --production
pm2 start src/index.js --name puerta-lobres-api

# Frontend (build estático)
cd frontend
npm install
npm run build
# Servir con nginx o similar desde dist/
```

Para exponer el webhook con dominio propio, configura nginx como proxy inverso al puerto 3001.
