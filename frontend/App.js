import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const API_URL = 'http://10.137.112.65:8000';

const COLONIAS = [
  'Zona Centro', 'Las Arboledas', 'Sector Norte - Av. Tecnológico', 
  'San Juanico', 'Los Olivos', 'Rancho Seco', 
  'Norte Extremo - Rumbos de Roque', 'Nororiente - Ciudad Industrial',
  'Suroriente - Universidad Latina', 'Poniente - Hospital General', 
  'Eje Juan Pablo II - Sede UG Sur', 'Zona de Oro - Torres Landa',
  'Las Insurgentes', 'Trojes', 
  'Sur Poniente - La Toscana', 'Norponiente - San José de Celaya'
];

export default function App() {
  const [screen, setScreen] = useState('splash');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [usarTelefono, setUsarTelefono] = useState(false);
  const [token, setToken] = useState(null);
  const [domicilios, setDomicilios] = useState([]);
  const [domicilioActivo, setDomicilioActivo] = useState(null);
  const [eta, setEta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [coloniaSeleccionada, setColoniaSeleccionada] = useState('');
  const [mostrarColonias, setMostrarColonias] = useState(false);
  const [direccion, setDireccion] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [notifConfig, setNotifConfig] = useState({
    routeStart: true,
    proximity: true,
    completed: true,
  });
  const [alertaOperativa, setAlertaOperativa] = useState(null);
  const [localizando, setLocalizando] = useState(false);
  const [latGPS, setLatGPS] = useState(20.5185);
  const [lngGPS, setLngGPS] = useState(-100.8450);
  const [coloniasCP, setColoniasCP] = useState([]);

  useEffect(() => {
    cargarSesion();
  }, []);

  useEffect(() => {
    let ws = null;
    let interval = null;
    if (screen === 'eta' && domicilioActivo && token) {
      ws = conectarWebSocket(domicilioActivo.id, token);
      interval = setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          consultarETA(domicilioActivo.id, token, true);
        }
      }, 120000);
    }
    return () => {
      if (ws) ws.close();
      if (interval) clearInterval(interval);
    };
  }, [screen, domicilioActivo, token]);

  const enviarNotificacionLocal = async (titulo, cuerpo) => {
    Alert.alert(titulo, cuerpo);
  };

  const cargarSesion = async () => {
    try {
      const t = await AsyncStorage.getItem('token');
      const dId = await AsyncStorage.getItem('domicilioId');
      const config = await AsyncStorage.getItem('notifConfig');
      if (config) setNotifConfig(JSON.parse(config));
      if (t) {
        setToken(t);
        const doms = await cargarDomicilios(t);
        if (doms && doms.length > 0) {
          const activo = dId ? doms.find(d => d.id === parseInt(dId)) || doms[0] : doms[0];
          setDomicilioActivo(activo);
          setScreen('eta');
          consultarETA(activo.id, t);
        } else {
          setScreen('domicilio');
        }
      } else {
        setScreen('login');
      }
    } catch { setScreen('login'); }
  };

  const cargarDomicilios = async (t) => {
    try {
      const res = await fetch(`${API_URL}/domicilios`, {
        headers: { 'Authorization': `Bearer ${t || token}` }
      });
      const data = await res.json();
      setDomicilios(data);
      return data;
    } catch { return []; }
  };

  const cerrarSesion = async () => {
    await AsyncStorage.clear();
    setToken(null); setDomicilios([]); setDomicilioActivo(null);
    setEta(null); setEmail(''); setPassword(''); setTelefono('');
    setDireccion(''); setColoniaSeleccionada(''); setCodigoPostal('');
    setNotifConfig({ routeStart: true, proximity: true, completed: true });
    setScreen('login');
  };

  const register = async () => {
    const identifier = usarTelefono ? telefono.trim() : email.trim();
    if (!identifier || !password.trim()) {
      Alert.alert('Campos requeridos', 'Por favor completa todos los campos'); return;
    }
    if (password.length < 4) {
      Alert.alert('Contraseña débil', 'Mínimo 4 caracteres'); return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password }),
      });
      const data = await res.json();
      if (data.access_token) {
        setToken(data.access_token);
        await AsyncStorage.setItem('token', data.access_token);
        setScreen('domicilio');
      } else {
        Alert.alert('Error', data.detail || 'Error al registrar');
      }
    } catch { Alert.alert('Error', 'No se pudo conectar al servidor'); }
    setLoading(false);
  };

  const login = async () => {
    const identifier = usarTelefono ? telefono.trim() : email.trim();
    if (!identifier || !password.trim()) {
      Alert.alert('Campos requeridos', 'Por favor completa todos los campos'); return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password }),
      });
      const data = await res.json();
      if (data.access_token) {
        setToken(data.access_token);
        await AsyncStorage.setItem('token', data.access_token);
        const doms = await cargarDomicilios(data.access_token);
        if (doms && doms.length > 0) {
          const activo = doms[0];
          setDomicilioActivo(activo);
          await AsyncStorage.setItem('domicilioId', String(activo.id));
          setScreen('eta');
          consultarETA(activo.id, data.access_token);
        } else {
          setScreen('domicilio');
        }
      } else { Alert.alert('Error', 'Credenciales incorrectas'); }
    } catch { Alert.alert('Error', 'No se pudo conectar al servidor'); }
    setLoading(false);
  };

  const guardarDomicilio = async () => {
    if (!direccion.trim() || !coloniaSeleccionada) {
      Alert.alert('Campos requeridos', 'Ingresa dirección y selecciona una colonia'); return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/domicilios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ direccion, colonia: coloniaSeleccionada, lat: latGPS, lng: lngGPS }),
      });
      const data = await res.json();
      if (data.id) {
        await AsyncStorage.setItem('domicilioId', String(data.id));
        setDomicilioActivo(data);
        await cargarDomicilios(token);
        setDireccion(''); setColoniaSeleccionada(''); setCodigoPostal('');
        setLatGPS(20.5185); setLngGPS(-100.8450);
        setScreen('eta');
        consultarETA(data.id, token);
      } else { Alert.alert('Error', data.detail || 'Colonia no encontrada'); }
    } catch { Alert.alert('Error', 'No se pudo guardar el domicilio'); }
    setLoading(false);
  };

  const consultarETA = async (id, t, silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/eta/${id}`, {
        headers: { 'Authorization': `Bearer ${t || token}` }
      });
      const data = await res.json();
      if (data.mensaje) {
        if (data.evento === 'TRUCK_PROXIMITY' && eta?.evento !== 'TRUCK_PROXIMITY' && notifConfig.proximity) {
          enviarNotificacionLocal('🚨 ¡Camión cercano!',
            `El camión está a menos de 15 minutos de ${data.colonia}. Saca tus bolsas a la acera.`);
        }
        if (data.evento === 'ROUTE_START' && eta?.evento !== 'ROUTE_START' && notifConfig.routeStart) {
          enviarNotificacionLocal('🟢 Ruta iniciada',
            `El camión de ${data.colonia} ha salido. Prepara tus residuos.`);
        }
        if (data.evento === 'ROUTE_COMPLETED' && eta?.evento !== 'ROUTE_COMPLETED' && notifConfig.completed) {
          enviarNotificacionLocal('✅ Servicio finalizado',
            `El camión de ${data.colonia} ha concluido su jornada.`);
        }
        setEta(data);
      }
    } catch { if (!silencioso) Alert.alert('Error', 'No se pudo obtener el ETA'); }
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (domicilioActivo) await consultarETA(domicilioActivo.id, token, true);
    setRefreshing(false);
  }, [domicilioActivo, token]);

  const seleccionarDomicilio = async (dom) => {
    setDomicilioActivo(dom);
    await AsyncStorage.setItem('domicilioId', String(dom.id));
    consultarETA(dom.id, token, true);
  };

  const conectarWebSocket = (id, t) => {
    const ws = new WebSocket(`ws://10.137.112.65:8000/ws/eta/${id}?token=${t}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.mensaje) {
        if (data.evento === 'TRUCK_PROXIMITY' && eta?.evento !== 'TRUCK_PROXIMITY' && notifConfig.proximity) {
          enviarNotificacionLocal('🚨 ¡Camión cercano!',
            `El camión está a menos de 15 minutos de ${data.colonia}. Saca tus bolsas a la acera.`);
        }
        if (data.evento === 'ROUTE_START' && eta?.evento !== 'ROUTE_START' && notifConfig.routeStart) {
          enviarNotificacionLocal('🟢 Ruta iniciada',
            `El camión de ${data.colonia} ha salido. Prepara tus residuos.`);
        }
        if (data.evento === 'ROUTE_COMPLETED' && eta?.evento !== 'ROUTE_COMPLETED' && notifConfig.completed) {
          enviarNotificacionLocal('✅ Servicio finalizado',
            `El camión de ${data.colonia} ha concluido su jornada.`);
        }
        setEta(data);
        if (domicilioActivo?.route_id) {
          verificarAlertas(domicilioActivo.route_id, t || token);
        }
      }
    };
    ws.onerror = () => console.log('WS error, usando polling');
    ws.onclose = () => console.log('WS cerrado');
    return ws;
  };

  const verificarAlertas = async (routeId, t) => {
    try {
      const res = await fetch(`${API_URL}/alertas/operativa/activa?route_id=${routeId}`, {
        headers: { 'Authorization': `Bearer ${t || token}` }
      });
      const data = await res.json();
      if (data.activa) setAlertaOperativa(data);
      else setAlertaOperativa(null);
    } catch {}
  };

  const usarUbicacion = async () => {
    setLocalizando(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a tu ubicación');
        setLocalizando(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;
      setLatGPS(latitude);
      setLngGPS(longitude);

      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode.length > 0) {
        const lugar = geocode[0];
        const dirAuto = `${lugar.street || ''} ${lugar.streetNumber || ''}`.trim();
        const cpAuto = lugar.postalCode || '';
        if (dirAuto) setDireccion(dirAuto);
        if (cpAuto) {
          await buscarColoniasPorCP(cpAuto);
        }
        Alert.alert('📍 Ubicación detectada', 
          `Dirección: ${dirAuto}\nCP: ${cpAuto}\nSelecciona tu colonia del listado`);
      }
    } catch {
      Alert.alert('Error', 'No se pudo obtener tu ubicación');
    }
    setLocalizando(false);
  };

  const buscarColoniasPorCP = async (cp) => {
    setCodigoPostal(cp);
    if (cp.length === 5) {
      try {
        const res = await fetch(`${API_URL}/colonias-por-cp?codigo_postal=${cp}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.encontrado && data.colonias.length > 0) {
          setColoniasCP(data.colonias);
        } else {
          setColoniasCP([]);
        }
      } catch { setColoniasCP([]); }
    } else {
      setColoniasCP([]);
    }
  };

  if (screen === 'splash') return (
    <View style={styles.splashContainer}>
      <Text style={styles.splashEmoji}>🚛</Text>
      <Text style={styles.splashTitle}>BasuraApp</Text>
      <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
    </View>
  );

  if (screen === 'login') return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.bigEmoji}>🚛</Text>
      <Text style={styles.title}>BasuraApp</Text>
      <Text style={styles.subtitle}>Ingresa a tu cuenta</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity style={[styles.toggleBtn, !usarTelefono && styles.toggleActive]}
          onPress={() => setUsarTelefono(false)}>
          <Text style={[styles.toggleText, !usarTelefono && styles.toggleTextActive]}>📧 Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, usarTelefono && styles.toggleActive]}
          onPress={() => setUsarTelefono(true)}>
          <Text style={[styles.toggleText, usarTelefono && styles.toggleTextActive]}>📱 Teléfono</Text>
        </TouchableOpacity>
      </View>
      {usarTelefono
        ? <TextInput style={styles.input} placeholder="Número de teléfono" value={telefono}
            onChangeText={setTelefono} keyboardType="phone-pad" />
        : <TextInput style={styles.input} placeholder="Email" value={email}
            onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      }
      <TextInput style={styles.input} placeholder="Contraseña" value={password}
        onChangeText={setPassword} secureTextEntry />
      {loading ? <ActivityIndicator color="#1a7a4a" size="large" style={{ marginTop: 16 }} /> : <>
        <TouchableOpacity style={styles.btn} onPress={login}>
          <Text style={styles.btnText}>Iniciar sesión</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={register}>
          <Text style={styles.btnSecondaryText}>Crear cuenta nueva</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 16 }}
          onPress={() => Alert.alert('Soporte', 'Escríbenos a soporte@basuraapp.mx\no llama al 800-BASURA-1')}>
          <Text style={styles.linkText}>¿Necesitas ayuda? Contactar soporte</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 8 }}
          onPress={() => Alert.alert('Recuperar contraseña', 'Te enviaremos un enlace a tu email o un SMS a tu teléfono registrado.')}>
          <Text style={styles.linkText}>Olvidé mi contraseña</Text>
        </TouchableOpacity>
      </>}
    </ScrollView>
  );

  if (screen === 'domicilio') return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>📍 Agregar domicilio</Text>
      <Text style={styles.subtitle}>¿Dónde quieres recibir alertas?</Text>
      <TextInput style={styles.input} placeholder="Dirección (ej: Calle Morelos 123)"
        value={direccion} onChangeText={setDireccion} />
      <TextInput style={styles.input} placeholder="Código postal (ej: 38000)"
        value={codigoPostal} onChangeText={buscarColoniasPorCP} keyboardType="numeric" />
      <TouchableOpacity
        style={[styles.btnUbicacion, localizando && { opacity: 0.6 }]}
        onPress={usarUbicacion}
        disabled={localizando}>
        {localizando
          ? <ActivityIndicator color="#1a7a4a" size="small" />
          : <Text style={styles.btnUbicacionText}>📡 Usar mi ubicación actual</Text>
        }
      </TouchableOpacity>
      <TouchableOpacity style={[styles.input, styles.combobox]}
        onPress={() => setMostrarColonias(!mostrarColonias)}>
        <Text style={{ color: coloniaSeleccionada ? '#1a1a1a' : '#999', fontSize: 15 }}>
          {coloniaSeleccionada || 'Selecciona tu colonia ▾'}
        </Text>
      </TouchableOpacity>
      {mostrarColonias && (
        <View style={styles.dropdown}>
          {(coloniasCP.length > 0 ? coloniasCP : COLONIAS).map(c => (
            <TouchableOpacity key={c} style={styles.dropdownItem}
              onPress={() => { setColoniaSeleccionada(c); setMostrarColonias(false); }}>
              <Text style={styles.dropdownText}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {domicilios.length > 0 && (
        <View style={styles.domiciliosExistentes}>
          <Text style={styles.domiciliosTitle}>Tus domicilios registrados:</Text>
          {domicilios.map(d => (
            <TouchableOpacity key={d.id} style={[styles.domicilioChip,
              domicilioActivo?.id === d.id && styles.domicilioChipActivo]}
              onPress={() => { seleccionarDomicilio(d); setScreen('eta'); }}>
              <Text style={styles.domicilioChipText}>📍 {d.direccion} — {d.colonia}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {loading ? <ActivityIndicator color="#1a7a4a" size="large" /> :
        <TouchableOpacity style={styles.btn} onPress={guardarDomicilio}>
          <Text style={styles.btnText}>Guardar domicilio</Text>
        </TouchableOpacity>}
      {domicilios.length > 0 &&
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setScreen('eta')}>
          <Text style={styles.btnSecondaryText}>← Volver al horario</Text>
        </TouchableOpacity>}
      <TouchableOpacity onPress={cerrarSesion} style={{ marginTop: 24 }}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  if (screen === 'eta') return (
    <ScrollView contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1a7a4a']} />}>
      <Text style={styles.title}>🕐 Horario de recolección</Text>
      {domicilios.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ width: '100%', marginBottom: 12 }}
          contentContainerStyle={{ alignItems: 'center', paddingVertical: 4 }}>
          {domicilios.map(d => (
            <TouchableOpacity key={d.id}
              style={[styles.domicilioTab, domicilioActivo?.id === d.id && styles.domicilioTabActivo]}
              onPress={() => seleccionarDomicilio(d)}>
              <Text style={[styles.domicilioTabText, domicilioActivo?.id === d.id && styles.domicilioTabTextActivo]}>
                📍 {d.colonia}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {loading ? <ActivityIndicator size="large" color="#1a7a4a" /> : eta ? <>
        <View style={styles.etaCard}>
          <Text style={styles.etaEvento}>
            {eta.evento === 'TRUCK_PROXIMITY' ? '🚨 ¡Camión cercano!' :
             eta.evento === 'ROUTE_START' ? '🟢 Ruta iniciada' :
             eta.evento === 'ROUTE_COMPLETED' ? '✅ Servicio finalizado' : '🚛 En camino'}
          </Text>
          <Text style={styles.etaMensaje}>{eta.mensaje}</Text>
          <View style={styles.ventanaBox}>
            <Text style={styles.ventanaLabel}>Ventana de llegada</Text>
            <Text style={styles.ventanaHora}>{eta.ventana_inicio} – {eta.ventana_fin}</Text>
          </View>
          <Text style={styles.coloniaText}>📍 {eta.colonia} · {eta.route_id}</Text>
        </View>
        {alertaOperativa && (
          <View style={styles.alertaBox}>
            <Text style={styles.alertaTitulo}>⚠️ Alerta operativa</Text>
            <Text style={styles.alertaMensaje}>{alertaOperativa.mensaje}</Text>
          </View>
        )}
        <View style={styles.privacyBox}>
          <Text style={styles.privacyText}>🔒 Solo ves la información de tu zona. No se muestra la ruta completa del camión.</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={() => consultarETA(domicilioActivo.id, token)}>
          <Text style={styles.btnText}>Actualizar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setScreen('domicilio')}>
          <Text style={styles.btnSecondaryText}>➕ Agregar otro domicilio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setScreen('separacion')}>
          <Text style={styles.btnSecondaryText}>📚 Guía de separación</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setScreen('reporte')}>
          <Text style={styles.btnSecondaryText}>📋 Reportar incidencia</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => setScreen('configuracion')}>
          <Text style={styles.btnSecondaryText}>⚙️ Configurar alertas</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={cerrarSesion} style={{ marginTop: 16 }}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </> : <Text>Sin datos</Text>}
    </ScrollView>
  );

  if (screen === 'separacion') return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>♻️ Guía de separación</Text>
      {[
        { emoji: '🟢', tipo: 'Orgánicos', ejemplos: 'Cáscaras, restos de comida, café, frutas' },
        { emoji: '🔵', tipo: 'Reciclables', ejemplos: 'Papel, cartón, plástico, vidrio, metal' },
        { emoji: '🔴', tipo: 'Sanitarios', ejemplos: 'Pañales, papel higiénico, gasas, algodón' },
        { emoji: '⚠️', tipo: 'Especiales', ejemplos: 'Pilas, medicamentos, electrónicos, pinturas' },
      ].map(item => (
        <View key={item.tipo} style={styles.separacionCard}>
          <Text style={styles.separacionEmoji}>{item.emoji}</Text>
          <View>
            <Text style={styles.separacionTipo}>{item.tipo}</Text>
            <Text style={styles.separacionEjemplos}>{item.ejemplos}</Text>
          </View>
        </View>
      ))}
      <TouchableOpacity style={styles.btnSecondary} onPress={() => setScreen('eta')}>
        <Text style={styles.btnSecondaryText}>← Volver al horario</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  if (screen === 'reporte') return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>📋 Reportar incidencia</Text>
      <Text style={styles.subtitle}>¿Qué problema tuviste?</Text>
      {['El camión no pasó', 'Pasó fuera de horario', 'No recogió mis residuos', 'Otro'].map(tipo => (
        <TouchableOpacity key={tipo} style={styles.btnSecondary}
          onPress={async () => {
            await fetch(`${API_URL}/reportes?domicilio_id=${domicilioActivo?.id}&tipo=${tipo}&descripcion=${tipo}`, {
              method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
            });
            Alert.alert('¡Gracias!', 'Tu reporte fue enviado correctamente.');
            setScreen('eta');
          }}>
          <Text style={styles.btnSecondaryText}>{tipo}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.btnSecondary} onPress={() => setScreen('eta')}>
        <Text style={styles.btnSecondaryText}>← Cancelar</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  if (screen === 'configuracion') return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>⚙️ Configurar alertas</Text>
      <Text style={styles.subtitle}>Elige qué notificaciones recibir</Text>
      {[
        { key: 'routeStart', label: '🟢 Ruta iniciada', desc: 'Cuando el camión sale del depósito' },
        { key: 'proximity', label: '🚨 Camión cercano', desc: 'Cuando el camión está a menos de 15 min' },
        { key: 'completed', label: '✅ Servicio finalizado', desc: 'Cuando el camión termina su recorrido' },
      ].map(item => (
        <TouchableOpacity key={item.key}
          style={[styles.notifItem, notifConfig[item.key] && styles.notifItemActivo]}
          onPress={async () => {
            const nueva = { ...notifConfig, [item.key]: !notifConfig[item.key] };
            setNotifConfig(nueva);
            await AsyncStorage.setItem('notifConfig', JSON.stringify(nueva));
          }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifLabel}>{item.label}</Text>
            <Text style={styles.notifDesc}>{item.desc}</Text>
          </View>
          <Text style={{ fontSize: 24 }}>{notifConfig[item.key] ? '🔔' : '🔕'}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.btnSecondary} onPress={() => setScreen('eta')}>
        <Text style={styles.btnSecondaryText}>← Volver al horario</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  splashContainer: { flex: 1, backgroundColor: '#1a7a4a', alignItems: 'center', justifyContent: 'center' },
  splashEmoji: { fontSize: 72 },
  splashTitle: { fontSize: 36, fontWeight: 'bold', color: '#fff', marginTop: 16 },
  container: { flexGrow: 1, backgroundColor: '#f0f4f8', alignItems: 'center', justifyContent: 'center', padding: 24 },
  bigEmoji: { fontSize: 64, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1a7a4a', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#555', marginBottom: 20, textAlign: 'center' },
  input: { width: '100%', backgroundColor: '#fff', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: '#ddd' },
  combobox: { justifyContent: 'center' },
  dropdown: { width: '100%', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#ddd', marginBottom: 12, overflow: 'hidden' },
  dropdownItem: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  dropdownText: { fontSize: 15, color: '#1a1a1a' },
  toggleRow: { flexDirection: 'row', width: '100%', marginBottom: 16, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#1a7a4a' },
  toggleBtn: { flex: 1, padding: 12, alignItems: 'center' },
  toggleActive: { backgroundColor: '#1a7a4a' },
  toggleText: { fontSize: 14, color: '#1a7a4a', fontWeight: '500' },
  toggleTextActive: { color: '#fff' },
  btn: { width: '100%', backgroundColor: '#1a7a4a', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnSecondary: { width: '100%', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#1a7a4a' },
  btnSecondaryText: { color: '#1a7a4a', fontWeight: 'bold', fontSize: 15 },
  linkText: { color: '#1a7a4a', fontSize: 13, textAlign: 'center' },
  logoutText: { color: '#e53935', fontSize: 14, textAlign: 'center' },
  domiciliosExistentes: { width: '100%', marginBottom: 12 },
  domiciliosTitle: { fontSize: 13, color: '#555', marginBottom: 8 },
  domicilioChip: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', marginBottom: 6 },
  domicilioChipActivo: { borderColor: '#1a7a4a', backgroundColor: '#e8f5ee' },
  domicilioChipText: { fontSize: 13, color: '#333' },
  domicilioTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', marginRight: 8, height: 36, justifyContent: 'center' },
  domicilioTabActivo: { backgroundColor: '#1a7a4a', borderColor: '#1a7a4a', height: 36 },
  domicilioTabText: { fontSize: 13, color: '#555' },
  domicilioTabTextActivo: { color: '#fff', fontWeight: '500' },
  etaCard: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#d0e8d8' },
  etaEvento: { fontSize: 18, fontWeight: 'bold', color: '#1a7a4a', marginBottom: 8 },
  etaMensaje: { fontSize: 15, color: '#333', marginBottom: 16, lineHeight: 22 },
  ventanaBox: { backgroundColor: '#e8f5ee', borderRadius: 10, padding: 14, marginBottom: 12 },
  ventanaLabel: { fontSize: 12, color: '#555', marginBottom: 4 },
  ventanaHora: { fontSize: 24, fontWeight: 'bold', color: '#1a7a4a' },
  coloniaText: { fontSize: 12, color: '#888' },
  privacyBox: { width: '100%', backgroundColor: '#fff8e1', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#ffe082' },
  privacyText: { fontSize: 12, color: '#795548', textAlign: 'center' },
  separacionCard: { width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#ddd' },
  separacionEmoji: { fontSize: 32 },
  separacionTipo: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  separacionEjemplos: { fontSize: 12, color: '#666', marginTop: 2 },
  notifItem: { width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  notifItemActivo: { borderColor: '#1a7a4a', backgroundColor: '#e8f5ee' },
  notifLabel: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  notifDesc: { fontSize: 12, color: '#666', marginTop: 2 },
  alertaBox: { width: '100%', backgroundColor: '#fff3e0', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#ff9800' },
  alertaTitulo: { fontSize: 14, fontWeight: 'bold', color: '#e65100', marginBottom: 4 },
  alertaMensaje: { fontSize: 13, color: '#bf360c' },
  btnUbicacion: { width: '100%', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 12, borderWidth: 1.5, borderColor: '#1a7a4a', borderStyle: 'dashed', backgroundColor: '#e8f5ee' },
  btnUbicacionText: { color: '#1a7a4a', fontWeight: '500', fontSize: 14 },
});