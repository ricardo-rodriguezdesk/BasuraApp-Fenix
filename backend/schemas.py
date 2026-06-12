from pydantic import BaseModel
from typing import Optional

class UsuarioCreate(BaseModel):
    email: str
    password: str

class UsuarioLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class DomicilioCreate(BaseModel):
    direccion: str
    colonia: str
    lat: float
    lng: float

class DomicilioResponse(BaseModel):
    id: int
    direccion: str
    colonia: str
    route_id: str
    class Config:
        from_attributes = True

class ETAResponse(BaseModel):
    route_id: str
    colonia: str
    current_position: int
    mensaje: str
    ventana_inicio: str
    ventana_fin: str
    evento: str