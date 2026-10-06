// Mesa / solicitudes - proyecto de clase
// Servidor hecho solo con módulos de Node (sin dependencias externas).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const RUTA_DB = path.join(__dirname, 'data', 'db.json');
const RUTA_PUBLIC = path.join(__dirname, 'public');

const CATEGORIAS = ['Acceso', 'Software', 'Hardware', 'Red', 'Otro'];
const PRIORIDADES = ['Baja', 'Media', 'Urgente'];
const ESTADOS = ['Nuevo', 'En curso', 'Resuelto'];

// ---------- base de datos (archivo JSON) ----------
function hashClave(clave) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(clave, sal, 32).toString('hex');
  return sal + ':' + hash;
}

function claveCorrecta(clave, guardada) {
  const [sal, hash] = guardada.split(':');
  const intento = crypto.scryptSync(clave, sal, 32);
  return crypto.timingSafeEqual(intento, Buffer.from(hash, 'hex'));
}

function nuevoId() {
  return crypto.randomBytes(4).toString('hex');
}

function crearDatosIniciales() {
  const clave = hashClave('1234');
  const ahora = new Date().toISOString();
  const db = {
    usuarios: [
      { id: 1, nombre: 'Ana Ríos', correo: 'ana@empresa.com', clave, rol: 'solicitante' },
      { id: 2, nombre: 'Luis Mena', correo: 'luis@empresa.com', clave, rol: 'coordinador' },
      { id: 3, nombre: 'Marta Soto', correo: 'marta@empresa.com', clave, rol: 'auditor' }
    ],
    solicitudes: [],
    historial: []
  };
  const ejemplos = [
    ['No puedo acceder al portal', 'Me marca error al iniciar sesión desde ayer.', 'Acceso', 'Urgente', 'Nuevo'],
    ['Instalar editor de documentos', 'Necesito el editor en mi equipo nuevo.', 'Software', 'Media', 'En curso']
  ];
  for (const [titulo, descripcion, categoria, prioridad, estado] of ejemplos) {
    const id = nuevoId();
    db.solicitudes.push({ id, titulo, descripcion, categoria, prioridad, estado, usuarioId: 1, creada: ahora });
    db.historial.push({ solicitudId: id, usuarioId: 1, accion: 'Creó la solicitud', fecha: ahora });
  }
  return db;
}

function cargarDB() {
  if (!fs.existsSync(RUTA_DB)) {
    fs.mkdirSync(path.dirname(RUTA_DB), { recursive: true });
    guardarDB(crearDatosIniciales());
  }
  return JSON.parse(fs.readFileSync(RUTA_DB, 'utf8'));
}

function guardarDB(db) {
  fs.writeFileSync(RUTA_DB, JSON.stringify(db, null, 2));
}

let db = cargarDB();

function registrar(solicitudId, usuarioId, accion) {
  db.historial.push({ solicitudId, usuarioId, accion, fecha: new Date().toISOString() });
}

// ---------- sesiones (en memoria) ----------
const sesiones = new Map();

function leerCookie(req, nombre) {
  const cookies = req.headers.cookie || '';
  for (const parte of cookies.split(';')) {
    const [k, v] = parte.trim().split('=');
    if (k === nombre) return v;
  }
  return null;
}

function usuarioActual(req) {
  const sid = leerCookie(req, 'sid');
  return sid ? sesiones.get(sid) || null : null;
}

// ---------- utilidades ----------
function responder(res, estado, datos, cabeceras = {}) {
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', ...cabeceras });
  res.end(JSON.stringify(datos));
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let texto = '';
    req.on('data', (parte) => {
      texto += parte;
      if (texto.length > 100000) {
        reject(new Error('Cuerpo demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(texto ? JSON.parse(texto) : {});
      } catch (e) {
        reject(new Error('JSON inválido'));
      }
    });
  });
}

function nombreDe(usuarioId) {
  const u = db.usuarios.find((x) => x.id === usuarioId);
  return u ? u.nombre : 'Desconocido';
}

function conAutor(s) {
  return { ...s, autor: nombreDe(s.usuarioId) };
}

function puedeVer(usuario, s) {
  return usuario.rol !== 'solicitante' || s.usuarioId === usuario.id;
}

// ---------- rutas de la API ----------
async function manejarApi(req, res, ruta) {
  const metodo = req.method;
  const usuario = usuarioActual(req);

  if (ruta === '/api/login' && metodo === 'POST') {
    const { correo = '', clave = '' } = await leerCuerpo(req);
    const u = db.usuarios.find((x) => x.correo === String(correo).trim().toLowerCase());
    if (!u || !claveCorrecta(String(clave), u.clave)) {
      return responder(res, 401, { error: 'Correo o contraseña incorrectos.' });
    }
    const sid = crypto.randomBytes(24).toString('hex');
    const datos = { id: u.id, nombre: u.nombre, rol: u.rol };
    sesiones.set(sid, datos);
    return responder(res, 200, datos, {
      'Set-Cookie': `sid=${sid}; HttpOnly; Path=/; SameSite=Strict`
    });
  }

  if (ruta === '/api/logout' && metodo === 'POST') {
    sesiones.delete(leerCookie(req, 'sid'));
    return responder(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' });
  }

  // todo lo demás necesita sesión
  if (!usuario) return responder(res, 401, { error: 'Inicia sesión para continuar.' });

  if (ruta === '/api/yo' && metodo === 'GET') {
    return responder(res, 200, usuario);
  }

  if (ruta === '/api/opciones' && metodo === 'GET') {
    return responder(res, 200, { categorias: CATEGORIAS, prioridades: PRIORIDADES, estados: ESTADOS });
  }

  if (ruta === '/api/solicitudes' && metodo === 'GET') {
    const lista = db.solicitudes
      .filter((s) => puedeVer(usuario, s))
      .sort((a, b) => b.creada.localeCompare(a.creada))
      .map(conAutor);
    return responder(res, 200, lista);
  }

  if (ruta === '/api/solicitudes' && metodo === 'POST') {
    if (usuario.rol !== 'solicitante') return responder(res, 403, { error: 'Solo los solicitantes pueden crear solicitudes.' });
    const cuerpo = await leerCuerpo(req);
    const titulo = String(cuerpo.titulo || '').trim();
    const descripcion = String(cuerpo.descripcion || '').trim();
    const categoria = cuerpo.categoria;
    const prioridad = cuerpo.prioridad || 'Media';
    if (!titulo || !descripcion || !CATEGORIAS.includes(categoria) || !PRIORIDADES.includes(prioridad)) {
      return responder(res, 400, { error: 'Completa el título, la descripción y la categoría.' });
    }
    const s = {
      id: nuevoId(), titulo: titulo.slice(0, 100), descripcion: descripcion.slice(0, 2000),
      categoria, prioridad, estado: 'Nuevo', usuarioId: usuario.id, creada: new Date().toISOString()
    };
    db.solicitudes.push(s);
    registrar(s.id, usuario.id, 'Creó la solicitud');
    guardarDB(db);
    return responder(res, 201, conAutor(s));
  }

  const coincide = ruta.match(/^\/api\/solicitudes\/([a-f0-9]+)$/);
  if (coincide) {
    const s = db.solicitudes.find((x) => x.id === coincide[1]);
    if (!s || !puedeVer(usuario, s)) return responder(res, 404, { error: 'Solicitud no encontrada.' });

    if (metodo === 'GET') return responder(res, 200, conAutor(s));

    if (metodo === 'PATCH') {
      if (usuario.rol !== 'coordinador') return responder(res, 403, { error: 'No tienes permiso para modificarla.' });
      const { estado, prioridad } = await leerCuerpo(req);
      if (!ESTADOS.includes(estado) || !PRIORIDADES.includes(prioridad)) {
        return responder(res, 400, { error: 'Estado o prioridad no válidos.' });
      }
      s.estado = estado;
      s.prioridad = prioridad;
      registrar(s.id, usuario.id, `Cambió a estado '${estado}' y prioridad '${prioridad}'`);
      guardarDB(db);
      return responder(res, 200, conAutor(s));
    }
  }

  if (ruta === '/api/registro' && metodo === 'GET') {
    if (usuario.rol !== 'auditor') return responder(res, 403, { error: 'Solo el auditor puede ver el registro.' });
    const filas = db.historial.slice().reverse().map((h) => {
      const s = db.solicitudes.find((x) => x.id === h.solicitudId);
      return { ...h, usuario: nombreDe(h.usuarioId), titulo: s ? s.titulo : '(eliminada)' };
    });
    return responder(res, 200, filas);
  }

  return responder(res, 404, { error: 'Ruta no encontrada.' });
}

// ---------- archivos estáticos ----------
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

function servirArchivo(req, res, ruta) {
  const pedido = ruta === '/' ? '/index.html' : ruta;
  const archivo = path.join(RUTA_PUBLIC, path.normalize(pedido));
  if (!archivo.startsWith(RUTA_PUBLIC) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('No encontrado');
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
  fs.createReadStream(archivo).pipe(res);
}

// ---------- servidor ----------
const servidor = http.createServer(async (req, res) => {
  const ruta = new URL(req.url, 'http://localhost').pathname;
  try {
    if (ruta.startsWith('/api/')) await manejarApi(req, res, ruta);
    else servirArchivo(req, res, ruta);
  } catch (error) {
    responder(res, 400, { error: error.message });
  }
});

servidor.listen(PORT, () => {
  console.log(`Mesa / solicitudes corriendo en http://localhost:${PORT}`);
});
