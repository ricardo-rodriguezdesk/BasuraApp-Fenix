# 🚛 BasuraApp — HackOnLinces 2026

Sistema de notificación inteligente y privada de recolección de residuos para la ciudadanía de Celaya, Guanajuato.

## 🎯 Problemática

Los ciudadanos no saben con certeza cuándo pasará el camión recolector, lo que genera basura en la calle fuera de horario, problemas de salud pública y fauna nociva.

## ✅ Solución

App móvil que notifica la hora aproximada de llegada del camión **sin exponer la ruta completa**, bajo un principio de **Privacidad por Diseño**.

## 🏗️ Arquitectura
Frontend (React Native / Expo)
↓ JWT + HTTPS + WebSocket
API Gateway + Auth (FastAPI)
↓ RBAC por domicilio
┌──────────────────────────────────────────┐
│  ETA Service  │  Simulator  │  WS Server │
│  (cálculo)    │  (cron job) │  (tiempo   │
│  + Haversine  │  15 rutas   │   real)    │
└──────────────────────────────────────────┘
↓
PostgreSQL — Usuario → Domicilio → Zona → Ruta
## 🔒 Privacidad por Diseño

- El usuario **solo ve** la ventana de llegada de su ruta asignada
- La API valida en cada request que el `usuario` solo accede a su `domicilio`
- **Prohibido**: mapa en tiempo real, rastreo del camión, explorar rutas ajenas
- Mensajería preventiva: la app desalienta sacar basura fuera de horario

## 📱 Funcionalidades MVP

- [x] Registro e inicio de sesión con JWT (email o teléfono)
- [x] Múltiples domicilios por usuario (casa y trabajo)
- [x] Alta de domicilio con 220 colonias reales de Celaya por código postal
- [x] Geolocalización GPS para autocompletar dirección y CP
- [x] Validación geoespacial con algoritmo Haversine
- [x] ETA con ventana de llegada (±7 min)
- [x] Simulador de rutas — cron job cada 2 min avanza 15 rutas
- [x] WebSockets para ETA en tiempo real (fallback a polling cada 2 min)
- [x] 3 eventos de notificación: ROUTE_START, TRUCK_PROXIMITY, ROUTE_COMPLETED
- [x] Notificaciones configurables por tipo (activar/desactivar)
- [x] Alertas operativas — retrasos y fallas mecánicas en tiempo real
- [x] Guía de separación de residuos (funciona offline)
- [x] RBAC — cada usuario solo consulta su ruta
- [x] Buzón de reportes con 4 categorías
- [x] Persistencia de sesión con AsyncStorage
- [x] Pull to refresh y auto-refresh
- [x] APK nativo compilado con EAS Build

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React Native + Expo SDK 54 |
| Backend | Python 3.12 + FastAPI |
| Tiempo real | WebSockets (FastAPI) |
| Auth | JWT (python-jose + passlib) |
| Base de datos | PostgreSQL + SQLAlchemy |
| Simulador | APScheduler (cron job cada 2 min) |
| Geoespacial | Haversine + Nominatim (OpenStreetMap) |
| Colonias | zippopotam.us + Nominatim (298 CPs, 220 colonias) |
| Geolocalización | expo-location + reverseGeocodeAsync |
| Build nativo | EAS Build (Expo) |
| Control de versiones | Gitea (git.onlinces.net) |

## 🚀 Cómo correr el proyecto

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000 --host 0.0.0.0
```

### Frontend
```bash
cd frontend
npm install
npx expo start
```

### Documentación de la API
Disponible en `http://localhost:8000/docs` (Swagger UI)

## 📊 Datasets utilizados

- `data/rutas.json` — 15 rutas con 8 posiciones GPS cada una
- `data/colonias-rutas.json` — 7 colonias oficiales del dataset
- `data/colonias_celaya.json` — 298 colonias reales obtenidas via zippopotam.us
- `data/colonias_celaya_coords.json` — 220 colonias con coordenadas reales via Nominatim
- `data/colonias-rutas-completo.json` — 220 colonias mapeadas a 15 rutas con Haversine

## 🔌 Endpoints principales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/register` | Registro con email o teléfono |
| POST | `/auth/login` | Login con JWT |
| POST | `/domicilios` | Alta de domicilio |
| GET | `/domicilios` | Listar domicilios del usuario |
| GET | `/eta/{domicilio_id}` | Ventana de llegada ETA |
| POST | `/reportes` | Buzón de retroalimentación |
| POST | `/alertas/operativa` | Crear alerta de retraso/falla |
| DELETE | `/alertas/operativa/{route_id}` | Eliminar alerta operativa |
| GET | `/alertas/operativa/activa` | Consultar alerta activa |
| GET | `/colonias-por-cp` | Colonias reales por código postal |
| GET | `/domicilios/ruta-por-coordenadas` | Mapeo GPS a ruta por Haversine |
| WS | `/ws/eta/{domicilio_id}` | ETA en tiempo real vía WebSocket |
| GET | `/admin/rutas/estado` | Estado real de las 15 rutas (panel admin) |

## 👥 Equipo — Fénix

| Nombre | Matrícula |
|--------|-----------|
| Ricardo Rodriguez Arellano | 21031301@itcelaya.edu.mx |


> *"No importa si llegas a caer, regresarás de las cenizas"*
- **hack_21031301_c761d3** — HackOnLinces 2026
