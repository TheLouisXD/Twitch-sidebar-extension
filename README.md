# Twitch Live Sidebar

Extensión React para ver los canales seguidos en Twitch, abrir sus directos y recibir notificaciones cuando empiezan a emitir. Incluye compilaciones separadas para Firefox y Chrome.

## Desarrollo y validación

Requiere Node.js 20.19+ (rama 20) o 22.12+ y npm.

```sh
npm ci
npm run lint
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
- `src/session.js`: restauración, validación, renovación compartida y cierre de sesión. El access token queda en `storage.session`; el refresh token persiste en `storage.local`.
- `src/twitch.js`: consultas y paginación de Twitch; las respuestas fallidas no reemplazan la caché con listas vacías.
- `src/oauth.js`: estado aleatorio y comprobación del redirect OAuth.
- `src/cache.js`: cachés y preferencias; las escrituras concurrentes de notificaciones se serializan en el proceso de fondo.
- `src/preferences.js`: intervalo de actualización y orden de favoritos.
- `manifests/`: manifiestos autoritativos para cada navegador.

El proceso de fondo realiza el login completo y conserva la sesión al cerrar el panel. La interfaz se actualiza mediante los cambios de almacenamiento, incluidas otras ventanas abiertas.

## Preferencias de la lista

En Configuración se puede elegir una actualización en segundo plano cada 1, 2, 3, 5, 10, 15, 30 o 60 minutos; el valor predeterminado es 3 minutos. El cambio reprograma la alarma y se conserva al reiniciar el navegador. Al abrir el panel se muestra primero la caché y se consulta de nuevo Twitch. El contador del panel muestra el total de canales en vivo, incluso al buscar, y el badge de la extensión usa la misma lista guardada.

«Favoritos en vivo primero» usa los canales con la campana activada como favoritos. Al habilitarlo, aparecen primero cuando están en vivo; cada grupo conserva el orden por espectadores. Los canales desconectados permanecen en su sección. El ajuste está desactivado inicialmente.

## OAuth y servicio de autenticación

El servicio está en `../twitch-auth-worker/`. Su secreto se configura en Cloudflare como `TWITCH_CLIENT_SECRET`; nunca se incluye en la extensión. El flujo usa el authorization code grant de Twitch con secreto del servidor y `state` validado. No se presenta como PKCE: el servicio anterior exigía un `code_verifier` que no enviaba a Twitch. La extensión sigue enviando ese campo legado para funcionar con el servicio ya desplegado; el Worker nuevo permite omitirlo.

La versión instalada de Wrangler requiere Node.js 22; usa Node.js 22.12+ para trabajar también en el Worker.

El redirect de Firefox observado con el ID del manifiesto es:

```text
https://f0a2ceefdf3784484246ec275b3ad757515d8cca.extensions.allizom.org/
```

Debe estar registrado exactamente, incluida la barra final, en la aplicación Twitch configurada con `CLIENT_ID`. Para Chrome, obtener el redirect en la consola del service worker con `chrome.identity.getRedirectURL()`; depende del ID de la extensión. El cliente y el Worker deben usar el mismo Client ID.

```sh
cd ../twitch-auth-worker
npm ci
npm test
npx wrangler deploy --dry-run
```

Los cambios del Worker se han validado localmente; requieren un despliegue independiente para entrar en producción. El override de `miniflare > sharp` fija 0.35.5 para evitar la versión vulnerable 0.35.4 incluida por Wrangler; retirarlo cuando Miniflare integre la corrección.

Ver [BUILD.md](BUILD.md) para reproducción y límites de la comprobación de Firefox.
