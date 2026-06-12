from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    domicilios = relationship("Domicilio", back_populates="usuario")

class Domicilio(Base):
    __tablename__ = "domicilios"
    id = Column(Integer, primary_key=True, index=True)
    direccion = Column(String)
    colonia = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    route_id = Column(String)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    usuario = relationship("Usuario", back_populates="domicilios")

class EstadoRuta(Base):
    __tablename__ = "estado_rutas"
    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(String, unique=True, index=True)
    current_position_id = Column(Integer, default=1)
    status = Column(String, default="EN_RUTA")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)