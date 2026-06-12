<div align="center">

# 🚛 BasuraApp — Fénix

### Notificacion inteligente y privada de recoleccion de residuos
#### Celaya, Guanajuato · HackOnLinces 2026

<br/>

![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSockets-010101?style=for-the-badge&logo=socketdotio&logoColor=white)

<br/>

*"No importa si llegas a caer, regresaras de las cenizas"*

</div>

---

## 📑 Contenido

- [Problematica](#-problematica)
- [Solucion](#-solucion)
- [Arquitectura](#%EF%B8%8F-arquitectura)
- [Privacidad por Diseno](#-privacidad-por-diseno)
- [Funcionalidades](#-funcionalidades-mvp)
- [Stack Tecnologico](#%EF%B8%8F-stack-tecnologico)
- [Como correr el proyecto](#-como-correr-el-proyecto)
- [Endpoints](#-endpoints-principales)
- [Equipo](#-equipo--fenix)

---

## 🎯 Problematica

Los ciudadanos no saben con certeza cuando pasara el camion recolector, lo que genera basura en la calle fuera de horario, problemas de salud publica y fauna nociva.

## ✅ Solucion

App movil que notifica la hora aproximada de llegada del camion **sin exponer la ruta completa**, bajo un principio de **Privacidad por Diseno**.

---

## 🏗️ Arquitectura

```
                Frontend (React Native / Expo)
                            │
                  JWT + HTTPS + WebSocket
                            │
                API Gateway + Auth (FastAPI)
                            │
                    RBAC por domicilio
                            │
    ┌───────────────┬───────────────┬───────────────┐
    │  ETA Service  │   Simulator   │   WS Server   │
    │   (calculo)   │  (cron job)   │ (tiempo real) │
    │  + Haversine  │   15 rutas    │               │
    └───────────────┴───────────────┴───────────────┘
                            │
        PostgreSQL — Usuario → Domicilio → Zona → Ruta
```

---

## 🔒 Privacidad por Diseno

- El usuario **solo ve** la ventana de llegada de su ruta asignada.
- La API valida en cada request que el `usuario` solo accede a su `domicilio`.
- **Prohibido por diseno:** mapa en tiempo real, rastreo del camion, explorar rutas ajenas.
- Mensajeria preventiva: la app desalienta sacar basura fuera de horario.

---

## 📱 Funcionalidades MVP

**Autenticacion y usuarios**
- Registro e inicio de sesion con JWT (email o telefono).
- Multiples domicilios por usuario (casa y trabajo).
- Persistencia de sesion con AsyncStorage.

**Geolocalizacion**
- Alta de domicilio con 220 colonias reales de Celaya por codigo postal.
- Geolocalizacion GPS para autocompletar direccion y CP.
- Validacion geoespacial con algoritmo Haversine.

**Tiempo real**
- ETA con ventana de llegada (±7 min).
- Simulador de rutas: cron job cada 2 min avanza 15 rutas.
- WebSockets para ETA en tiempo real (fallback a polling cada 2 min).
- 3 eventos de notificacion: `ROUTE_START`, `TRUCK_PROXIMITY`, `ROUTE_COMPLETED`.
- Notificaciones configurables por tipo.
- Alertas operativas: retrasos y fallas mecanicas en tiempo real.

**Otras**
- Guia de separacion de residuos (funciona offline).
- RBAC: cada usuario solo consulta su ruta.
- Buzon de reportes con 4 categorias.
- Pull to refresh y auto-refresh.
- APK nativo compilado con EAS Build.

---

## 🛠️ Stack Tecnologico

| Capa | Tecnologia |
| :--- | :--- |
| Frontend | React Native + Expo SDK 54 |
| Backend | Python 3.12 + FastAPI |
| Tiempo real | WebSockets (FastAPI) |
| Auth | JWT (python-jose + passlib) |
| Base de datos | PostgreSQL + SQLAlchemy |
| Simulador | APScheduler (cron job cada 2 min) |
| Geoespacial | Haversine + Nominatim (OpenStreetMap) |
| Colonias | zippopotam.us + Nominatim (298 CPs, 220 colonias) |
| Geolocalizacion | expo-location + reverseGeocodeAsync |
| Build nativo | EAS Build (Expo) |

---

## 🚀 Como correr el proyecto

### Requisitos previos

- Python 3.12+
- Node.js 18+
- PostgreSQL
- Variable de entorno `SECRET_KEY` definida (ver mas abajo)

### Configuracion de seguridad

Antes de correr el backend, define la clave secreta para los JWT:

```bash
# Linux / Mac
export SECRET_KEY="tu-clave-secreta-aqui"

# Windows (CMD)
set SECRET_KEY=tu-clave-secreta-aqui
```

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # En Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000 --host 0.0.0.0
```

### Frontend

```bash
cd frontend
npm install
npx expo start
```

### Documentacion de la API

Swagger UI disponible en `http://localhost:8000/docs`

---

## 📊 Datasets utilizados

| Archivo | Contenido |
| :--- | :--- |
| `data/rutas.json` | 15 rutas con 8 posiciones GPS cada una |
| `data/colonias_celaya.json` | 298 colonias reales (via zippopotam.us) |
| `data/colonias_celaya_coords.json` | 220 colonias con coordenadas reales (via Nominatim) |
| `data/colonias-rutas-completo.json` | 220 colonias mapeadas a 15 rutas con Haversine |

---

## 🔌 Endpoints principales

| Metodo | Endpoint | Descripcion |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | Registro con email o telefono |
| `POST` | `/auth/login` | Login con JWT |
| `POST` | `/domicilios` | Alta de domicilio |
| `GET` | `/domicilios` | Listar domicilios del usuario |
| `GET` | `/eta/{domicilio_id}` | Ventana de llegada ETA |
| `POST` | `/reportes` | Buzon de retroalimentacion |
| `POST` | `/alertas/operativa` | Crear alerta de retraso/falla |
| `GET` | `/alertas/operativa/activa` | Consultar alerta activa |
| `GET` | `/colonias-por-cp` | Colonias reales por codigo postal |
| `GET` | `/domicilios/ruta-por-coordenadas` | Mapeo GPS a ruta por Haversine |
| `WS` | `/ws/eta/{domicilio_id}` | ETA en tiempo real via WebSocket |
| `GET` | `/admin/rutas/estado` | Estado de las 15 rutas (panel admin) |

---

## 👨‍💻 Mi rol

**Desarrollo tecnico completo del proyecto** — frontend (React Native), backend (FastAPI), base de datos, API REST, autenticacion JWT, logica geoespacial (Haversine), simulador de rutas y servidor WebSocket. Implemente la totalidad del sistema de extremo a extremo.

## 👥 Equipo — Fenix

Proyecto presentado como equipo en el hackathon **HackOnLinces 2026**:

- **Ricardo Rodriguez Arellano** — Desarrollo tecnico completo (frontend, backend, base de datos, tiempo real)
- Edith Roque Moya
- Vivian Goretti Vargas de la Cruz
- Geraldine Romero Garcia

> Instituto Tecnologico de Celaya · HackOnLinces 2026

---

<div align="center">

*Hecho con esfuerzo de equipo en formato hackathon* 🔥

</div>
