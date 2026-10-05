# Pulso: ranking de tendencias

Tres contenedores separados:

| Servicio   | Imagen                 | Puerto | Qué hace                              |
|------------|------------------------|--------|---------------------------------------|
| `frontend` | Nginx (build propio)   | 8080   | Sirve la página y reenvía `/api` al backend |
| `backend`  | Node 20 + Express      | 3000   | API REST                              |
| `db`       | PostgreSQL 16          | interno| Guarda las tendencias (volumen `datos_db`) |

## Ponerlo a funcionar

```bash
docker compose up --build -d
```

Abre http://localhost:8080

La primera vez el backend crea la tabla y carga 8 tendencias de ejemplo.

## Comandos útiles

```bash
docker compose ps                      # ver los 3 contenedores
docker compose logs -f backend         # logs del backend
curl http://localhost:3000/api/salud   # probar el backend directo
docker compose exec db psql -U pulso -d pulso -c "SELECT * FROM tendencias;"
docker compose down                    # detener (conserva los datos)
docker compose down -v                 # detener y borrar la base de datos
```

## API

- `GET /api/salud`
- `GET /api/categorias`
- `GET /api/tendencias?categoria=Música`
- `POST /api/tendencias` con `{ "titulo", "categoria", "descripcion" }`
- `POST /api/tendencias/:id/votar`
- `DELETE /api/tendencias/:id`

## Si un puerto está ocupado

Cambia el lado izquierdo en `docker-compose.yml`, por ejemplo `"8081:80"`.
