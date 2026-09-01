# Mostrador — consulta de precios de la despensa

Una sola app que corre en la PC y en el celular. Buscás por código de barras o
por nombre, y el precio aparece en letra grande. Vos ves y cargás todo; a quien
le des acceso solo puede consultar precios.

- **Base de datos y cuentas:** Supabase
- **La página:** Vercel
- **Costo:** cero, con el plan gratis de las dos

---

## Verla andando ya, sin Supabase

Antes de configurar nada:

```
npm install
npm run dev
```

Abrí `http://localhost:5173`. Como todavía no hay `.env`, la app arranca en
**modo prueba** con doce productos de ejemplo. Entrá con:

| Cuenta | Contraseña | Qué ve |
|---|---|---|
| `alex@prueba.com` | `despensa` | Todo: costos, carga, accesos |
| `marta@prueba.com` | `despensa` | Solo el buscador y el precio de venta |

Probá a escribir `7790895000119` de corrido, como haría el lector: aparece la
ficha, la casilla se vacía sola y la barrita de arriba destella. Nada de lo que
cargues se guarda; al recargar vuelve a los datos de ejemplo.

En cuanto crees el `.env` del paso 5, la app pasa sola a Supabase de verdad.

---

## Puesta en marcha

Son seis pasos. La primera vez lleva media hora; la mayor parte es esperar.

### 1. Crear el proyecto en Supabase

En [supabase.com](https://supabase.com) → New project. Elegí la región más
cercana (São Paulo) y guardá la contraseña de la base en algún lado.

### 2. Correr el esquema

Supabase → **SQL Editor** → New query. Pegá **todo** el contenido de
`supabase/esquema.sql` y dale Run.

Crea las tablas, el historial de precios, el buscador y —lo más importante— los
candados que impiden que tus costos lleguen al navegador de quien solo consulta.
Se puede correr más de una vez sin romper nada.

### 3. Apagar la confirmación por mail

Authentication → Providers → Email → destildá **Confirm email**.

Sin esto, cada persona a la que le des acceso tiene que confirmar un mail que
probablemente no exista.

### 4. Crear tu cuenta y hacerte dueño

Authentication → **Users** → Add user → poné tu mail y una contraseña.
Copiá el **User UID** que aparece en la lista.

Volvé al SQL Editor y corré esto con tu UID:

```sql
insert into public.perfiles (id, nombre, dueno)
values ('pegá-acá-tu-uuid', 'Alex', true);
```

Es el único paso manual del sistema. Y es a propósito: probé dejar que el primer
usuario se creara el perfil solo, y resultó un agujero por el que cualquiera que
se registrara quedaba de dueño.

### 5. Conectar la app

Project Settings → **API**. Copiá `Project URL` y la clave `anon public`.

En la carpeta del proyecto, copiá `.env.ejemplo` a `.env` y completalos.

```
npm install
npm run dev
```

Entrá a `http://localhost:5173` con el mail y la contraseña del paso 4.

> La clave `anon` es pública a propósito y viaja dentro de la página. Lo que
> protege los datos son las políticas del paso 2, no esconder esa clave. La que
> **nunca** va en el proyecto es la `service_role`.

### 6. Publicar en Vercel

1. Subí la carpeta a un repositorio de GitHub
2. En [vercel.com](https://vercel.com) → Add New → Project → elegí el repo
3. Vercel detecta Vite solo; no toques la configuración
4. En **Environment Variables** cargá `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` con los mismos valores del `.env`
5. Deploy

Te queda una dirección `https://...vercel.app`. Esa la abrís en el celular del
mostrador y la agregás a la pantalla de inicio.

---

## Cómo se usa

**Buscar.** Una sola casilla para las dos cosas. Si lo que entra son puros
dígitos, lo trata como código de barras y va directo al producto. Si tiene
letras, filtra por nombre, marca o presentación, sin importar las tildes.

**Escanear seguido.** Después de cada lectura la casilla se vacía sola y la
barrita de arriba de la ficha destella en verde. Escaneás uno atrás de otro sin
tocar nada. Si tocaste otra parte de la pantalla, el foco vuelve solo al
buscador — con un lector USB las teclas van a donde esté el foco.

**Cargar productos.** Menú → Cargar producto. **Empieza por el código de
barras**: escaneás y la app te dice enseguida si ese producto ya estaba cargado,
así no se duplica nada. Si no coincide con ninguno, seguís con el resto de los
datos y el código ya queda puesto. Para productos sin código hay un botón aparte.

**Editar un producto.** Menú → Todos los productos, y tocá cualquier fila. Se
puede cambiar todo: descripción, marca, presentación, código, rubro, proveedor y
los dos precios. Arriba te muestra el precio actual y, mientras escribís el
nuevo, cuánto por ciento representa el cambio.

**El margen se puede escribir.** En vez de calcular el precio de venta a mano,
ponés el costo y el margen que querés, y el precio sale solo. También funciona al
revés: si escribís el precio de venta, se recalcula el margen. Cargá el costo
primero — sin costo no hay margen que calcular.

**Sacar un producto.** Desde el editor. No se borra: deja de aparecer en el
buscador y en la lista, pero queda su historial de precios.

**Bajar y subir Excel.** Menú → Importar y exportar. Ver la sección de abajo.

**Dar acceso.** Menú → Usuarios y accesos. Nombre, mail y contraseña. Esa
persona entra y solo puede consultar precios. Podés quitarle el acceso sin
borrarla.

---

## Sin internet

El mostrador **sigue consultando precios** aunque se corte. Dos piezas:

- La app se guarda en el celular (se instala desde Chrome: menú → "Instalar app").
- Cada vez que entrás, se guarda la lista completa de productos en el navegador.

Si el servidor no responde, la búsqueda contesta con esa copia y aparece un
cartel ámbar: *"Sin conexión — estás viendo los precios guardados el 26 de
agosto, 19:27 h"*. Cuando vuelve, el cartel se va solo.

**Lo que no funciona sin internet:** cargar productos, cambiar precios y dar
accesos. Eso necesita servidor, y fingir que se guardó sería peor que avisarte.

La copia se borra al cerrar sesión, así que no le queda a nadie en el celular
después de salir. No tiene nada que ver con el Excel: es la app guardándose una
copia para sí misma, no un archivo en tu disco.

---

## Excel: bajar y subir la lista

**Bajar.** Te genera un `.xlsx` con todos los productos: ID, código, descripción,
marca, presentación, rubro, proveedor y los dos precios. Sirve de respaldo y
para editar precios en masa.

**Subir.** Elegís el archivo y **antes de tocar nada** te muestra qué va a pasar:
cuántos productos son nuevos, cuáles cambian de precio —con el antes, el después
y el porcentaje—, cuántos quedan igual y qué filas tienen problemas. Recién ahí
confirmás.

Los productos se reconocen primero por el **código de barras** y, si no tiene, por
el **ID**. Lo que no coincide con nada se carga como nuevo. Nunca se duplica un
producto existente.

Se saltean, avisándote fila por fila: las que no tienen descripción, las que no
tienen precio de venta, las de precio negativo y las que repiten un código
dentro del mismo archivo.

### Dos detalles que evitan que pierdas datos

**Los códigos van como texto.** Si fueran números, Excel convierte los 13 dígitos
a `7,79E+12` y el código se pierde sin dar ningún error. Es la forma más común de
arruinar un respaldo de productos.

**Los títulos se leen sin tildes ni mayúsculas**, y entiende sinónimos: `Codigo`,
`Código`, `EAN` y `Codigo de barras` son la misma columna; `Precio`, `Venta` y
`Precio de venta` también. Podés armar el archivo a mano sin copiar el formato
exacto.

Los precios aceptan `1.234,56` y `1234.56` indistintamente.

---

## Por qué está armado así

**Los costos no se ocultan, no se envían.** Quien solo consulta no lee la tabla
de productos: lee una vista que no tiene la columna de costo. No hay nada que
espiar abriendo las herramientas del navegador, porque el dato nunca sale del
servidor. Lo verifiqué contra un PostgreSQL de verdad, con dos usuarios
distintos, antes de entregarlo.

**El historial lo escribe la base, no la app.** Un disparador anota cada cambio
de precio. Así el historial no depende de que el código se acuerde de guardarlo,
y te va a servir para ver cuánto aumentó cada proveedor.

**Presentación es casi obligatorio.** Sin ese campo, buscar "coca" devuelve
cinco filas idénticas y el que atiende no sabe cuál tocar.

**Rubro y proveedor no se miran en el mostrador.** Están para que después puedas
subir todos los precios de un proveedor de una vez. La función ya está escrita
en el esquema (`aumentar_precios`); falta solo la pantalla.

---

## Lo que todavía no hace

- Aumento masivo por porcentaje (la función existe, falta el botón)
- Stock
- Fotos de los productos
- Cobrar

## Si algo falla

**"Tu cuenta existe pero no tiene perfil"** — te falta el paso 4. El mensaje te
muestra el SQL exacto con tu UID adentro.

**"Faltan las variables de entorno"** — no creaste el `.env`, o lo creaste pero
no reiniciaste `npm run dev`. Vite lee esas variables solo al arrancar.

**"La cuenta existe pero falta confirmar el mail"** — te falta el paso 3.

**En Vercel anda todo pero no encuentra la base** — cargaste las variables
después del primer deploy. Hay que volver a desplegar para que las tome.
