from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
from database import engine, get_db
from typing import Dict, Set, Optional
import asyncio
import models, schemas, auth, simulator

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="HackOnLinces 2026 - Recolección de Residuos")

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

alertas_activas: Dict[str, dict] = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, route_id: str):
        await websocket.accept()
        if route_id not in self.active_connections:
            self.active_connections[route_id] = set()
        self.active_connections[route_id].add(websocket)

    def disconnect(self, websocket: WebSocket, route_id: str):
        if route_id in self.active_connections:
            self.active_connections[route_id].discard(websocket)

    async def broadcast_to_route(self, route_id: str, message: dict):
        if route_id in self.active_connections:
            dead = set()
            for ws in self.active_connections[route_id]:
                try:
                    await ws.send_json(message)
                except:
                    dead.add(ws)
            self.active_connections[route_id] -= dead

manager = ConnectionManager()

scheduler = BackgroundScheduler()
scheduler.add_job(simulator.avanzar_rutas, "interval", minutes=2)
scheduler.start()

@app.on_event("startup")
def startup():
    db = next(get_db())
    simulator.init_rutas(db)

@app.get("/")
def root():
    return {"message": "API HackOnLinces 2026 funcionando"}

@app.post("/auth/register", response_model=schemas.Token)
def register(user: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    if db.query(models.Usuario).filter_by(email=user.email).first():
        raise HTTPException(status_code=400, detail="Email ya registrado")
    nuevo = models.Usuario(email=user.email,
                           hashed_password=auth.hash_password(user.password))
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    token = auth.create_token({"sub": nuevo.email})
    return {"access_token": token, "token_type": "bearer"}

@app.post("/auth/login", response_model=schemas.Token)
def login(user: schemas.UsuarioLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.Usuario).filter_by(email=user.email).first()
    if not db_user or not auth.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    token = auth.create_token({"sub": db_user.email})
    return {"access_token": token, "token_type": "bearer"}

@app.post("/domicilios", response_model=schemas.DomicilioResponse)
def crear_domicilio(data: schemas.DomicilioCreate,
                    current_user=Depends(auth.get_current_user),
                    db: Session = Depends(get_db)):
    colonia_key = data.colonia.lower()

    # 1. Buscar en colonias completas (220 colonias reales)
    colonia_info = simulator.COLONIAS_COMPLETAS.get(colonia_key)

    # 2. Buscar en colonias originales del dataset
    if not colonia_info:
        colonia_info = simulator.COLONIAS.get(colonia_key)

    # 3. Buscar por similitud parcial en colonias completas
    if not colonia_info:
        for key, value in simulator.COLONIAS_COMPLETAS.items():
            if key in colonia_key or colonia_key in key:
                colonia_info = value
                break

    # 4. Fallback por coordenadas GPS
    if not colonia_info:
        ruta, _ = simulator.encontrar_ruta_por_coordenadas(data.lat, data.lng)
        if ruta:
            colonia_info = next(
                (v for v in simulator.COLONIAS_COMPLETAS.values() if v["routeId"] == ruta["routeId"]),
                None
            )

    if not colonia_info:
        raise HTTPException(status_code=404, detail="Colonia no encontrada en el sistema")

    dom = models.Domicilio(direccion=data.direccion, colonia=data.colonia,
                           lat=data.lat, lng=data.lng,
                           route_id=colonia_info["routeId"],
                           usuario_id=current_user.id)
    db.add(dom)
    db.commit()
    db.refresh(dom)
    return dom

@app.get("/domicilios")
def listar_domicilios(
    current_user=Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    domicilios = db.query(models.Domicilio).filter_by(usuario_id=current_user.id).all()
    return [{"id": d.id, "direccion": d.direccion, "colonia": d.colonia, "route_id": d.route_id} for d in domicilios]

@app.get("/eta/{domicilio_id}", response_model=schemas.ETAResponse)
def get_eta(domicilio_id: int,
            current_user=Depends(auth.get_current_user),
            db: Session = Depends(get_db)):
    dom = db.query(models.Domicilio).filter_by(id=domicilio_id).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Domicilio no encontrado")
    if dom.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes acceso a este domicilio")
    eta = simulator.get_eta(dom.route_id, db)
    if not eta:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    return {**eta, "route_id": dom.route_id, "colonia": dom.colonia}

@app.get("/colonias-por-cp")
def colonias_por_cp(
    codigo_postal: str,
    current_user=Depends(auth.get_current_user)
):
    colonias = [
        v["colonia"] for v in simulator.COLONIAS_COMPLETAS.values()
        if v.get("cp") == codigo_postal
    ]
    return {
        "colonias": sorted(set(colonias)),
        "encontrado": len(colonias) > 0
    }

@app.get("/admin/rutas/estado")
def admin_estado_rutas(db: Session = Depends(get_db)):
    resultado = []
    for ruta in simulator.RUTAS:
        eta = simulator.get_eta(ruta["routeId"], db)
        resultado.append({
            "route_id": ruta["routeId"],
            "name": ruta["name"],
            "evento": eta["evento"] if eta else "DESCONOCIDO",
            "current_position": eta.get("current_position", 0) if eta else 0,
            "ventana_inicio": eta["ventana_inicio"] if eta else "--",
            "ventana_fin": eta["ventana_fin"] if eta else "--",
        })
    return resultado
    
@app.post("/reportes")
def crear_reporte(
    domicilio_id: int,
    tipo: str,
    descripcion: str,
    current_user=Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    dom = db.query(models.Domicilio).filter_by(id=domicilio_id).first()
    if not dom or dom.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes acceso a este domicilio")
    return {
        "mensaje": "Reporte recibido correctamente",
        "tipo": tipo,
        "domicilio_id": domicilio_id,
        "descripcion": descripcion,
        "estado": "PENDIENTE"
    }

@app.post("/alertas/operativa")
def crear_alerta_operativa(
    route_id: str,
    tipo: str,
    mensaje: str,
    db: Session = Depends(get_db)
):
    estado = db.query(models.EstadoRuta).filter_by(route_id=route_id).first()
    if not estado:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    alertas_activas[route_id] = {
        "route_id": route_id,
        "tipo": tipo,
        "mensaje": mensaje,
        "evento": "ALERTA_OPERATIVA",
        "activa": True
    }
    return alertas_activas[route_id]

@app.delete("/alertas/operativa/{route_id}")
def eliminar_alerta_operativa(route_id: str):
    if route_id in alertas_activas:
        del alertas_activas[route_id]
    return {"mensaje": "Alerta eliminada"}

@app.get("/alertas/operativa/activa")
def get_alerta_activa(
    route_id: str,
    current_user=Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    dom = db.query(models.Domicilio).filter_by(
        usuario_id=current_user.id, route_id=route_id
    ).first()
    if not dom:
        raise HTTPException(status_code=403, detail="Sin acceso")
    alerta = alertas_activas.get(route_id)
    if alerta:
        return alerta
    return {"activa": False, "mensaje": None}

@app.get("/domicilios/ruta-por-coordenadas")
def ruta_por_coordenadas(
    lat: float,
    lng: float,
    current_user=Depends(auth.get_current_user)
):
    ruta, distancia = simulator.encontrar_ruta_por_coordenadas(lat, lng)
    if not ruta:
        raise HTTPException(status_code=404, detail="No hay cobertura en esta ubicación")
    colonia_info = next(
        (c for c in simulator.COLONIAS.values() if c["routeId"] == ruta["routeId"]),
        None
    )
    return {
        "route_id": ruta["routeId"],
        "nombre_ruta": ruta["name"],
        "colonia_sugerida": colonia_info["colonia"] if colonia_info else ruta["name"],
        "distancia_metros": round(distancia),
        "cobertura": True
    }

@app.websocket("/ws/eta/{domicilio_id}")
async def websocket_eta(websocket: WebSocket, domicilio_id: int,
                        token: str, db: Session = Depends(get_db)):
    try:
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email = payload.get("sub")
        user = db.query(models.Usuario).filter_by(email=email).first()
        if not user:
            await websocket.close(code=1008)
            return
        dom = db.query(models.Domicilio).filter_by(id=domicilio_id).first()
        if not dom or dom.usuario_id != user.id:
            await websocket.close(code=1008)
            return
    except:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, dom.route_id)
    try:
        eta = simulator.get_eta(dom.route_id, db)
        if eta:
            await websocket.send_json({**eta, "route_id": dom.route_id, "colonia": dom.colonia})
        while True:
            await asyncio.sleep(30)
            eta = simulator.get_eta(dom.route_id, db)
            if eta:
                payload = {**eta, "route_id": dom.route_id, "colonia": dom.colonia}
                alerta = alertas_activas.get(dom.route_id)
                if alerta:
                    payload["alerta_operativa"] = alerta
                await websocket.send_json(payload)
    except WebSocketDisconnect:
        manager.disconnect(websocket, dom.route_id)
