import json
import os
import datetime
import math
from sqlalchemy.orm import Session
from database import SessionLocal
import models

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with open(os.path.join(BASE_DIR, "data", "rutas.json")) as f:
    RUTAS = json.load(f)

COLONIAS = {}
with open(os.path.join(BASE_DIR, "data", "colonias-rutas.json")) as f:
    for item in json.load(f):
        COLONIAS[item["colonia"].lower()] = item

COLONIAS_COMPLETAS = {}
try:
    with open(os.path.join(BASE_DIR, "data", "colonias-rutas-completo.json")) as f:
        for item in json.load(f):
            COLONIAS_COMPLETAS[item["colonia"].lower()] = item
except:
    pass

def init_rutas(db: Session):
    for ruta in RUTAS:
        existe = db.query(models.EstadoRuta).filter_by(route_id=ruta["routeId"]).first()
        if not existe:
            db.add(models.EstadoRuta(route_id=ruta["routeId"], current_position_id=1))
    db.commit()

def avanzar_rutas():
    db = SessionLocal()
    try:
        estados = db.query(models.EstadoRuta).all()
        for estado in estados:
            if estado.current_position_id < 8:
                estado.current_position_id += 1
                estado.updated_at = datetime.datetime.utcnow()
                print(f"[SIM] {estado.route_id} → posición {estado.current_position_id}")
            else:
                estado.current_position_id = 1
        db.commit()
    finally:
        db.close()

def get_eta(route_id: str, db: Session):
    estado = db.query(models.EstadoRuta).filter_by(route_id=route_id).first()
    if not estado:
        return None
    ruta = next((r for r in RUTAS if r["routeId"] == route_id), None)
    if not ruta:
        return None
    pos = estado.current_position_id
    if pos >= 8:
        return {"mensaje": "El servicio de hoy ha finalizado.", "evento": "ROUTE_COMPLETED",
                "ventana_inicio": "--", "ventana_fin": "--", "current_position": 8}
    pos_actual = ruta["positions"][pos - 1]
    pos_siguiente = ruta["positions"][min(pos, 7)]
    ts = datetime.datetime.fromisoformat(pos_siguiente["timestamp"].replace("Z", "+00:00"))
    ventana_fin = ts.strftime("%H:%M")
    ventana_inicio = (ts - datetime.timedelta(minutes=7)).strftime("%H:%M")
    if pos == 1:
        evento = "ROUTE_START"
        mensaje = "El camión está por iniciar su recorrido. Ten listos tus residuos."
    elif pos == 4:
        evento = "TRUCK_PROXIMITY"
        mensaje = f"El camión está a menos de 15 minutos. Saca tus bolsas a la acera."
    else:
        evento = "EN_CAMINO"
        mensaje = f"El camión llegará a tu zona entre las {ventana_inicio} y {ventana_fin}."
    return {"mensaje": mensaje, "evento": evento,
            "ventana_inicio": ventana_inicio, "ventana_fin": ventana_fin,
            "current_position": pos}

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat/2)**2 +
         math.cos(math.radians(lat1)) *
         math.cos(math.radians(lat2)) *
         math.sin(dlon/2)**2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c * 1000

def encontrar_ruta_por_coordenadas(lat: float, lng: float):
    mejor_ruta = None
    menor_distancia = float('inf')
    for ruta in RUTAS:
        for pos in ruta["positions"]:
            distancia = haversine(lat, lng, pos["lat"], pos["lng"])
            if distancia < menor_distancia:
                menor_distancia = distancia
                mejor_ruta = ruta
    if menor_distancia < 5000:
        return mejor_ruta, menor_distancia
    return None, None