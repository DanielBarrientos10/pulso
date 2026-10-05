const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'pulso',
  password: process.env.DB_PASSWORD || 'pulso123',
  database: process.env.DB_NAME || 'pulso',
});

const CATEGORIAS = ['Tecnología', 'Música', 'Moda', 'Cine y series', 'Videojuegos', 'Internet'];

const SEMILLA = [
  ['Agentes de IA que programan solos', 'Tecnología', 'Asistentes que abren el repositorio, escriben el código y prueban el resultado.', 412],
  ['Regreso de las cámaras digitales de 2008', 'Moda', 'Fotos con flash duro y grano: la estética compacta vuelve a las fiestas.', 367],
  ['Corridos tumbados en listas globales', 'Música', 'El regional mexicano sigue entrando al top mundial de streaming.', 341],
  ['Consolas portátiles tipo PC', 'Videojuegos', 'Jugar la biblioteca completa de PC desde el sofá o el bus.', 298],
  ['Series cortas de 6 episodios', 'Cine y series', 'Temporadas que se terminan en un fin de semana.', 254],
  ['Ropa de segunda mano', 'Moda', 'Comprar usado dejó de ser plan B y pasó a ser la primera opción.', 231],
  ['Videos verticales de más de 3 minutos', 'Internet', 'Las plataformas de video corto ahora premian el contenido largo.', 187],
  ['Vinilos y casetes', 'Música', 'El formato físico crece entre quienes nacieron después del MP3.', 143],
];

async function esperarBD(intentos = 30) {
  for (let i = 1; i <= intentos; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (e) {
      console.log(`Base de datos no disponible (intento ${i}/${intentos}): ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('No se pudo conectar a la base de datos');
}

async function prepararBD() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tendencias (
      id SERIAL PRIMARY KEY,
      titulo VARCHAR(120) NOT NULL,
      categoria VARCHAR(40) NOT NULL,
      descripcion VARCHAR(280) NOT NULL DEFAULT '',
      votos INTEGER NOT NULL DEFAULT 0,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM tendencias');
  if (rows[0].n === 0) {
    for (const [titulo, categoria, descripcion, votos] of SEMILLA) {
      await pool.query(
        'INSERT INTO tendencias (titulo, categoria, descripcion, votos) VALUES ($1, $2, $3, $4)',
        [titulo, categoria, descripcion, votos]
      );
    }
    console.log(`Se cargaron ${SEMILLA.length} tendencias de ejemplo`);
  }
}

const envolver = (fn) => (req, res, next) => fn(req, res).catch(next);

app.get('/api/salud', envolver(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ estado: 'ok', bd: 'conectada' });
}));

app.get('/api/categorias', (req, res) => res.json(CATEGORIAS));

app.get('/api/tendencias', envolver(async (req, res) => {
  const { categoria } = req.query;
  const sql = 'SELECT * FROM tendencias' +
    (categoria ? ' WHERE categoria = $1' : '') +
    ' ORDER BY votos DESC, creado_en DESC';
  const { rows } = await pool.query(sql, categoria ? [categoria] : []);
  res.json(rows);
}));

app.post('/api/tendencias', envolver(async (req, res) => {
  const titulo = String(req.body.titulo || '').trim();
  const categoria = String(req.body.categoria || '').trim();
  const descripcion = String(req.body.descripcion || '').trim();

  if (titulo.length < 3 || titulo.length > 120) {
    return res.status(400).json({ error: 'El título debe tener entre 3 y 120 caracteres.' });
  }
  if (!CATEGORIAS.includes(categoria)) {
    return res.status(400).json({ error: 'Elige una categoría de la lista.' });
  }
  if (descripcion.length > 280) {
    return res.status(400).json({ error: 'La descripción admite hasta 280 caracteres.' });
  }
  const { rows } = await pool.query(
    'INSERT INTO tendencias (titulo, categoria, descripcion) VALUES ($1, $2, $3) RETURNING *',
    [titulo, categoria, descripcion]
  );
  res.status(201).json(rows[0]);
}));

app.post('/api/tendencias/:id/votar', envolver(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id no válido.' });
  const { rows } = await pool.query(
    'UPDATE tendencias SET votos = votos + 1 WHERE id = $1 RETURNING *', [id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Esa tendencia ya no existe.' });
  res.json(rows[0]);
}));

app.delete('/api/tendencias/:id', envolver(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id no válido.' });
  const { rowCount } = await pool.query('DELETE FROM tendencias WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'Esa tendencia ya no existe.' });
  res.status(204).end();
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error del servidor. Revisa los logs del backend.' });
});

const PORT = Number(process.env.PORT || 3000);
esperarBD()
  .then(prepararBD)
  .then(() => app.listen(PORT, () => console.log(`Backend escuchando en el puerto ${PORT}`)))
  .catch((e) => { console.error(e); process.exit(1); });
