# Twitch Live Sidebar

Extensión React para ver los canales seguidos en Twitch, abrir sus directos y recibir notificaciones cuando empiezan a emitir. Incluye compilaciones separadas para Firefox y Chrome.

## Desarrollo y validación

Requiere Node.js 22.22.2+ (rama 22), 24.15+ (rama 24) o 26+, y npm. Las pruebas de interfaz usan JSDOM y necesitan estas versiones.

```sh
npm ci
npm run lint
npm run format:check
npm test
npm run build:all
```

- `dist-firefox/`: Firefox 115 o posterior; cargar `manifest.json` en `about:debugging` → Este Firefox → Cargar complemento temporal.
- `dist-chrome/`: Chrome 116 o posterior; cargar la carpeta con «Cargar descomprimida» en `chrome://extensions`.
- `npm run build:firefox` y `npm run build:chrome` generan cada paquete por separado.

`npm run dev` sirve la interfaz para desarrollo, pero las APIs de extensión requieren cargar un paquete en el navegador. Los ZIP antiguos de la carpeta no se regeneran con estos comandos.

## Organización

- `src/platform.js`: adapta `browser.*` con Promises y `chrome.*` con callbacks, incluyendo errores de las APIs.
- `src/background.js`: mensajes, sondeo configurable, badge, notificaciones y apertura del panel.
- `src/session.js`: restauración, validación, renovación compartida, migración de credenciales y cierre de sesión. El access token queda en `storage.session`; la ubicación del refresh token depende de «Recordar sesión».
- `src/twitch.js`: consultas y paginación de Twitch; las respuestas fallidas no reemplazan la caché con listas vacías.
- `src/oauth.js`: estado aleatorio y comprobación del redirect OAuth.
- `src/cache.js`: cachés y preferencias; las escrituras concurrentes de notificaciones se serializan en el proceso de fondo.
- `src/preferences.js`: intervalo de actualización, orden de favoritos y persistencia de sesión.
- `src/hooks/`: lecturas sincronizadas del almacenamiento y carga del perfil, independientes del trabajo decorativo de imágenes.
- `src/locales/translations.js`: textos de interfaz en español e inglés.
- `src/types.js`: contratos JSDoc para canales, preferencias y mensajes.
- `manifests/`: manifiestos autoritativos para cada navegador.

El proceso de fondo realiza el login completo y conserva la sesión al cerrar el panel. La interfaz se actualiza mediante los cambios de almacenamiento, incluidas otras ventanas abiertas.

## Preferencias de la lista

En Configuración se puede elegir una actualización en segundo plano cada 1, 2, 3, 5, 10, 15, 30 o 60 minutos; el valor predeterminado es 3 minutos. El cambio reprograma la alarma y se conserva al reiniciar el navegador. Al abrir el panel se muestra primero la caché y se consulta de nuevo Twitch. El contador del panel muestra el total de canales en vivo, incluso al buscar, y el badge de la extensión usa la misma lista guardada.

«Favoritos en vivo primero» usa los canales con la campana activada como favoritos. Al habilitarlo, aparecen primero cuando están en vivo; cada grupo conserva el orden por espectadores. Los canales desconectados permanecen en su sección. El ajuste está desactivado inicialmente.

«Recordar sesión» está activado inicialmente para mantener el comportamiento anterior. Al desactivarlo, el refresh token se mueve de `storage.local` a `storage.session` y se elimina la copia persistente. La sesión dura hasta cerrar el navegador, deshabilitar o recargar la extensión. Reactivar la opción permite restaurar la sesión al reiniciar. Las migraciones y renovaciones se serializan; un fallo de escritura intenta restaurar el modo anterior y se muestra como error de guardado. `storage.local` no cifra estas credenciales.

Un fallo temporal al comprobar la sesión permite reintentar sin mostrar un login falso. La interfaz y el fondo intercambian el estado `authenticated`, sin devolver credenciales en los mensajes de login/restauración. Las tarjetas admiten Tab y Enter; la campana también responde a Espacio y muestra su estado accesible.

## Convenciones

Componentes React y sus estilos usan nombres PascalCase; módulos, hooks y preferencias usan camelCase, y los campos de Twitch conservan los nombres de su API. Las importaciones locales indican la extensión del archivo. Prettier y `.editorconfig` fijan comillas dobles, dos espacios, ausencia de punto y coma y finales LF; `npm run format` aplica el formato y `npm run format:check` lo verifica.

Los comentarios explican decisiones, condiciones de carrera o requisitos de las APIs. Los contratos JSDoc documentan los límites entre módulos; no sustituyen una comprobación estática de tipos. Los colores y estados compartidos se definen con variables en `src/index.css`, para permitir futuros temas CSS. Ver [REVIEW.md](REVIEW.md) para los errores corregidos y los límites de la evaluación de seguridad.

## OAuth y servicio de autenticación

El servicio está en `../twitch-auth-worker/`. Su secreto se configura en Cloudflare como `TWITCH_CLIENT_SECRET`; nunca se incluye en la extensión. El flujo usa el authorization code grant de Twitch con secreto del servidor y `state` validado. No se presenta como PKCE: el servicio anterior exigía un `code_verifier` que no enviaba a Twitch. La extensión sigue enviando ese campo legado para funcionar con el servicio ya desplegado; el Worker nuevo permite omitirlo.

La versión instalada de Wrangler requiere Node.js 22. La versión indicada arriba permite trabajar en ambos proyectos.

El redirect de Firefox observado con el ID del manifiesto es:

```text
https://f0a2ceefdf3784484246ec275b3ad757515d8cca.extensions.allizom.org/
```

Debe estar registrado exactamente, incluida la barra final, en la aplicación Twitch configurada con `CLIENT_ID`. Las cuatro URLs registradas proporcionadas por el propietario están en `TWITCH_REDIRECT_URIS` del Worker; otras URLs se rechazan. Para Chrome, obtener el redirect en la consola del service worker con `chrome.identity.getRedirectURL()`; depende del ID de la extensión. El cliente y el Worker deben usar el mismo Client ID.

```sh
cd ../twitch-auth-worker
npm ci
npm test
npx wrangler deploy --dry-run
```

El Worker limita cuerpos, campos y solicitudes mediante el binding de Cloudflare, compartido entre `/exchange` y `/refresh`. Los cambios se han validado localmente; requieren un despliegue independiente para entrar en producción. Ver su `README.md` para configuración y límites. El override de `miniflare > sharp` fija 0.35.5 para evitar la versión vulnerable 0.35.4 incluida por Wrangler; retirarlo cuando Miniflare integre la corrección.

Ver [BUILD.md](BUILD.md) para reproducción y límites de la comprobación de Firefox.
