// Mesa / solicitudes - parte del cliente
const app = document.getElementById('app');
let usuario = null;
let opciones = null;

// ---------- utilidades ----------
function esc(texto) {
  const d = document.createElement('div');
  d.textContent = texto;
  return d.innerHTML;
}

function fecha(iso) {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function clase(texto) {
  return texto.toLowerCase().replace(' ', '');
}

async function api(url, metodo = 'GET', cuerpo) {
  const respuesta = await fetch(url, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || 'Ocurrió un error.');
  return datos;
}

function aviso(texto, tipo) {
  const zona = document.getElementById('avisos');
  if (zona) zona.innerHTML = `<p class="aviso ${tipo}">${esc(texto)}</p>`;
}

function nombreRol(rol) {
  return { solicitante: 'Solicitante', coordinador: 'Agente coordinador', auditor: 'Auditor' }[rol];
}

// ---------- login ----------
function mostrarLogin() {
  app.innerHTML = `
  <div class="login">
    <section class="portada">
      <div class="marca"><span class="logo">M</span> <b>Mesa</b> / solicitudes</div>
      <h1>Las cosas empiezan por escuchar.</h1>
      <p>Un solo lugar para pedir ayuda, ordenar el trabajo y dar seguimiento.</p>
      <ul class="roles">
        <li><b>Solicitante</b><br>Crea y consulta sus solicitudes</li>
        <li><b>Agente coordinador</b><br>Prioriza y organiza el trabajo</li>
        <li><b>Auditor</b><br>Consulta el registro completo</li>
      </ul>
    </section>
    <section class="formulario">
      <h2>Iniciar sesión</h2>
      <p>Ingresa con tu cuenta para continuar.</p>
      <div id="avisos"></div>
      <form id="form-login">
        <label for="correo">Correo electrónico</label>
        <input id="correo" type="email" placeholder="nombre@empresa.com" required>
        <label for="clave">Contraseña</label>
        <input id="clave" type="password" placeholder="Tu contraseña" required>
        <button class="boton">Entrar</button>
      </form>
      <small>Las cuentas de demostración están disponibles en el archivo README.</small>
    </section>
  </div>`;

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      usuario = await api('/api/login', 'POST', {
        correo: document.getElementById('correo').value,
        clave: document.getElementById('clave').value
      });
      location.hash = '#/solicitudes';
      iniciarApp();
    } catch (error) {
      aviso(error.message, 'error');
    }
  });
}

// ---------- estructura con menú lateral ----------
function armarMarco(activo, contenido) {
  const esSolicitante = usuario.rol === 'solicitante';
  const enlace = (hash, texto, clave) =>
    `<a href="${hash}" class="${activo === clave ? 'activo' : ''}">${texto}</a>`;
  let menu = enlace('#/solicitudes', esSolicitante ? 'Mis solicitudes' : 'Solicitudes', 'lista');
  if (esSolicitante) menu += enlace('#/nueva', 'Crear solicitud', 'nueva');
  if (usuario.rol === 'auditor') menu += enlace('#/registro', 'Registro completo', 'registro');

  app.innerHTML = `
  <div class="app">
    <aside class="lateral">
      <div class="marca"><span class="logo">M</span> <b>Mesa</b> / solicitudes</div>
      <p class="seccion">Espacio de trabajo</p>
      <nav>${menu}</nav>
      <div class="perfil">
        <span class="avatar">${esc(usuario.nombre[0])}</span>
        <div><b>${esc(usuario.nombre)}</b><br><small>${nombreRol(usuario.rol)}</small></div>
        <a href="#" id="salir" class="salir">Cerrar sesión</a>
      </div>
    </aside>
    <main class="contenido"><div id="avisos"></div>${contenido}</main>
  </div>`;

  document.getElementById('salir').addEventListener('click', async (e) => {
    e.preventDefault();
    await api('/api/logout', 'POST');
    usuario = null;
    location.hash = '';
    mostrarLogin();
  });
}

// ---------- vistas ----------
async function vistaLista() {
  const filas = await api('/api/solicitudes');
  const esSolicitante = usuario.rol === 'solicitante';
  const cuerpo = filas.map((s) => `
    <tr>
      <td><a href="#/solicitud/${s.id}"><b>${esc(s.titulo)}</b></a><br><small>${esc(s.categoria)} · ${s.id}</small></td>
      ${esSolicitante ? '' : `<td>${esc(s.autor)}</td>`}
      <td><span class="punto p-${clase(s.prioridad)}"></span>${s.prioridad}</td>
      <td><span class="punto e-${clase(s.estado)}"></span>${s.estado}</td>
    </tr>`).join('');

  armarMarco('lista', `
    <div class="encabezado">
      <div>
        <h1>${esSolicitante ? 'Mis solicitudes' : 'Solicitudes'}</h1>
        <p>${esSolicitante ? 'Consulta el estado y seguimiento de tus solicitudes.' : 'Todas las solicitudes registradas en la mesa.'}</p>
      </div>
      ${esSolicitante ? '<a class="boton" href="#/nueva">Nueva solicitud</a>' : ''}
    </div>
    <div class="tabla-caja">
      <p class="conteo"><b>Solicitudes registradas</b> <span>${filas.length} registros</span></p>
      ${filas.length ? `<table>
        <thead><tr><th>Solicitud</th>${esSolicitante ? '' : '<th>Solicitante</th>'}<th>Prioridad</th><th>Estado</th></tr></thead>
        <tbody>${cuerpo}</tbody></table>`
        : '<p class="vacio">Todavía no hay solicitudes. Crea la primera con el botón "Nueva solicitud".</p>'}
    </div>`);
}

function opcionesHtml(lista, elegida) {
  return lista.map((o) => `<option ${o === elegida ? 'selected' : ''}>${o}</option>`).join('');
}

function vistaNueva() {
  if (usuario.rol !== 'solicitante') return (location.hash = '#/solicitudes');
  armarMarco('nueva', `
    <h1>Crear solicitud</h1>
    <p>Completa los campos para agregar una solicitud a la mesa.</p>
    <form id="form-nueva" class="caja-form">
      <label for="titulo">Título *</label>
      <input id="titulo" maxlength="100" placeholder="Resume lo que necesitas" required>
      <label for="descripcion">Descripción *</label>
      <textarea id="descripcion" rows="6" placeholder="Añade el contexto y los detalles relevantes" required></textarea>
      <label for="categoria">Categoría *</label>
      <select id="categoria" required>
        <option value="">Selecciona una categoría</option>${opcionesHtml(opciones.categorias)}
      </select>
      <label for="prioridad">Prioridad</label>
      <select id="prioridad">${opcionesHtml(opciones.prioridades, 'Media')}</select>
      <div class="acciones">
        <a href="#/solicitudes">Cancelar</a>
        <button class="boton">Enviar solicitud</button>
      </div>
    </form>`);

  document.getElementById('form-nueva').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/solicitudes', 'POST', {
        titulo: document.getElementById('titulo').value,
        descripcion: document.getElementById('descripcion').value,
        categoria: document.getElementById('categoria').value,
        prioridad: document.getElementById('prioridad').value
      });
      location.hash = '#/solicitudes';
    } catch (error) {
      aviso(error.message, 'error');
    }
  });
}

async function vistaDetalle(id) {
  const s = await api('/api/solicitudes/' + id);
  const esCoordinador = usuario.rol === 'coordinador';
  const edicion = esCoordinador ? `
    <form id="form-editar" class="caja-form">
      <label for="estado">Estado</label>
      <select id="estado">${opcionesHtml(opciones.estados, s.estado)}</select>
      <label for="prioridad">Prioridad</label>
      <select id="prioridad">${opcionesHtml(opciones.prioridades, s.prioridad)}</select>
      <div class="acciones"><button class="boton">Guardar cambios</button></div>
    </form>` : `
    <p><span class="punto p-${clase(s.prioridad)}"></span>${s.prioridad} &nbsp;
       <span class="punto e-${clase(s.estado)}"></span>${s.estado}</p>`;

  armarMarco('lista', `
    <p><a href="#/solicitudes">&larr; Volver</a></p>
    <h1 class="chico">${esc(s.titulo)}</h1>
    <p><small>${esc(s.categoria)} · ${s.id} · creada por ${esc(s.autor)} el ${fecha(s.creada)}</small></p>
    <div class="caja-form"><p>${esc(s.descripcion)}</p></div>
    ${edicion}`);

  if (esCoordinador) {
    document.getElementById('form-editar').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/solicitudes/' + id, 'PATCH', {
          estado: document.getElementById('estado').value,
          prioridad: document.getElementById('prioridad').value
        });
        aviso('Cambios guardados.', 'ok');
      } catch (error) {
        aviso(error.message, 'error');
      }
    });
  }
}

async function vistaRegistro() {
  const filas = await api('/api/registro');
  const cuerpo = filas.map((h) => `
    <tr><td>${fecha(h.fecha)}</td><td>${esc(h.usuario)}</td>
        <td><a href="#/solicitud/${h.solicitudId}">${esc(h.titulo)}</a></td><td>${esc(h.accion)}</td></tr>`).join('');
  armarMarco('registro', `
    <h1>Registro completo</h1>
    <p>Historial de acciones sobre todas las solicitudes.</p>
    <div class="tabla-caja"><table>
      <thead><tr><th>Fecha</th><th>Usuario</th><th>Solicitud</th><th>Acción</th></tr></thead>
      <tbody>${cuerpo}</tbody></table></div>`);
}

// ---------- navegación ----------
async function mostrarVista() {
  if (!usuario) return mostrarLogin();
  const hash = location.hash || '#/solicitudes';
  try {
    if (hash === '#/nueva') vistaNueva();
    else if (hash === '#/registro') await vistaRegistro();
    else if (hash.startsWith('#/solicitud/')) await vistaDetalle(hash.split('/')[2]);
    else await vistaLista();
  } catch (error) {
    armarMarco('lista', `<h1 class="chico">${esc(error.message)}</h1><p><a href="#/solicitudes">Volver al inicio</a></p>`);
  }
}

async function iniciarApp() {
  opciones = await api('/api/opciones');
  mostrarVista();
}

window.addEventListener('hashchange', mostrarVista);

(async function () {
  try {
    usuario = await api('/api/yo');
    iniciarApp();
  } catch (e) {
    mostrarLogin();
  }
})();
