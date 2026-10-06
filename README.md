# Mesa / solicitudes

Aplicación web para crear y dar seguimiento a solicitudes internas de ayuda.
Hecha con **JavaScript**: servidor en Node.js (sin librerías externas) y cliente con JavaScript, HTML y CSS.

## Roles
- **Solicitante**: crea solicitudes y consulta solo las suyas.
- **Agente coordinador**: ve todas las solicitudes y cambia su estado y prioridad.
- **Auditor**: consulta todas las solicitudes y el registro completo de acciones (solo lectura).

## Cómo ejecutarlo
Necesitas Node.js 18 o superior.
```
node server.js
```
(o `npm start`). Abrir http://localhost:3000

No hace falta `npm install`. El archivo `data/db.json` se crea solo la primera vez;
para volver a los datos de ejemplo, bórralo y reinicia el servidor.

## Cuentas de demostración
Contraseña de todas: `demo1234`

| Rol | Correo |
|---|---|
| Solicitante | ana@empresa.com |
| Agente coordinador | luis@empresa.com |
| Auditor | marta@empresa.com |

## Estructura
```
server.js         servidor, API, sesiones y permisos
public/index.html página base
public/app.js     lógica del cliente (vistas y peticiones fetch)
public/style.css  estilos
data/db.json      datos (se genera automáticamente)
```

## API
| Método | Ruta | Quién |
|---|---|---|
| POST | /api/login, /api/logout | todos |
| GET | /api/solicitudes | todos (el solicitante solo ve las suyas) |
| POST | /api/solicitudes | solicitante |
| GET / PATCH | /api/solicitudes/:id | PATCH solo coordinador |
| GET | /api/registro | auditor |

## Notas
- Las contraseñas se guardan con hash (scrypt) y sal.
- El servidor valida el rol en cada ruta; no depende solo de ocultar botones.
- El texto del usuario se escapa antes de mostrarlo para evitar inyección de HTML.
