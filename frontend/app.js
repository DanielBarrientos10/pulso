const API = '/api';

const lista = document.getElementById('lista');
const aviso = document.getElementById('aviso');
const filtros = document.getElementById('filtros');
const estado = document.getElementById('estado');
const formulario = document.getElementById('formulario');
const mensaje = document.getElementById('mensaje');
const selectCategoria = document.getElementById('categoria');

let categoriaActiva = '';

async function pedir(ruta, opciones = {}) {
  const res = await fetch(API + ruta, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  if (res.status === 204) return null;
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error || `Error ${res.status}`);
  return datos;
}

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function mostrarAviso(texto) {
  aviso.textContent = texto;
  aviso.hidden = !texto;
}

function pintarFiltros(categorias) {
  filtros.replaceChildren();
  [['', 'Todas'], ...categorias.map((c) => [c, c])].forEach(([valor, nombre]) => {
    const b = crear('button', 'filtro', nombre);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(valor === categoriaActiva));
    b.addEventListener('click', () => {
      categoriaActiva = valor;
      pintarFiltros(categorias);
      cargar();
    });
    filtros.append(b);
  });
}

function pintarLista(tendencias) {
  lista.replaceChildren();
  if (!tendencias.length) {
    mostrarAviso(categoriaActiva
      ? `Todavía no hay tendencias en ${categoriaActiva}. Agrega la primera con el formulario.`
      : 'El ranking está vacío. Agrega la primera tendencia con el formulario.');
    return;
  }
  mostrarAviso('');
  const maximo = Math.max(...tendencias.map((t) => t.votos), 1);

  tendencias.forEach((t, i) => {
    const fila = crear('li', 'fila');
    fila.style.setProperty('--ancho', `${Math.round((t.votos / maximo) * 100)}%`);

    const cuerpo = crear('div');
    cuerpo.append(crear('span', 'categoria', t.categoria), crear('h3', '', t.titulo));
    if (t.descripcion) cuerpo.append(crear('p', '', t.descripcion));

    const votar = crear('button', 'votar', `▲ ${t.votos}`);
    votar.type = 'button';
    votar.setAttribute('aria-label', `Votar por ${t.titulo}. Tiene ${t.votos} votos`);
    votar.addEventListener('click', async () => {
      try {
        await pedir(`/tendencias/${t.id}/votar`, { method: 'POST' });
        cargar();
      } catch (e) { mostrarAviso(e.message); }
    });

    const borrar = crear('button', 'borrar', '✕');
    borrar.type = 'button';
    borrar.setAttribute('aria-label', `Eliminar ${t.titulo}`);
    borrar.title = 'Eliminar';
    borrar.addEventListener('click', async () => {
      if (!confirm(`¿Eliminar "${t.titulo}"?`)) return;
      try {
        await pedir(`/tendencias/${t.id}`, { method: 'DELETE' });
        cargar();
      } catch (e) { mostrarAviso(e.message); }
    });

    const acciones = crear('div', 'acciones');
    acciones.append(votar, borrar);

    fila.append(crear('span', 'puesto', String(i + 1)), cuerpo, acciones);
    lista.append(fila);
  });
}

async function cargar() {
  try {
    const q = categoriaActiva ? `?categoria=${encodeURIComponent(categoriaActiva)}` : '';
    pintarLista(await pedir(`/tendencias${q}`));
  } catch (e) {
    lista.replaceChildren();
    mostrarAviso('No se pudo cargar el ranking. Comprueba que el contenedor del backend esté en marcha.');
  }
}

async function comprobarEstado() {
  try {
    await pedir('/salud');
    estado.textContent = 'Base de datos conectada';
    estado.className = 'estado ok';
    return true;
  } catch (e) {
    estado.textContent = 'Sin conexión con el backend';
    estado.className = 'estado mal';
    return false;
  }
}

formulario.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const boton = formulario.querySelector('button[type="submit"]');
  const datos = Object.fromEntries(new FormData(formulario));
  boton.disabled = true;
  mensaje.className = 'mensaje';
  mensaje.textContent = '';
  try {
    await pedir('/tendencias', { method: 'POST', body: JSON.stringify(datos) });
    formulario.reset();
    mensaje.textContent = 'Tendencia agregada.';
    cargar();
  } catch (e) {
    mensaje.className = 'mensaje error';
    mensaje.textContent = e.message;
  } finally {
    boton.disabled = false;
  }
});

async function iniciar() {
  // El backend puede tardar unos segundos mientras espera a la base de datos.
  for (let i = 0; i < 10; i++) {
    if (await comprobarEstado()) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  try {
    const categorias = await pedir('/categorias');
    pintarFiltros(categorias);
    selectCategoria.replaceChildren(...categorias.map((c) => {
      const o = crear('option', '', c);
      o.value = c;
      return o;
    }));
  } catch (e) { /* el aviso de cargar() ya lo explica */ }
  cargar();
}

iniciar();
