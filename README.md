# Carros Usados CR — Agregador y Comparador de Agencias en Costa Rica

Aplicación web local (`localhost:3000`) que unifica el inventario de vehículos usados/seminuevos de las principales agencias de Costa Rica en una sola página, con filtros avanzados, conversión **USD (`$`) ↔ CRC (`₡`)** y calculadora de **cuánto dinero debes poner** descontando el monto de recibo (*trade-in*) personalizado por agencia.

## Agencias Incluidas (13 Agencias)
1. **Carsot CR** (`https://carsotcr.com/`)
2. **Seminuevos CR - Grupo Danissa** (`https://www.seminuevoscr.com/`)
3. **Purdy Usados** (`https://www.purdyusados.com/`)
4. **AutoStar Usados** (`https://usados.autostar.cr/`)
5. **Veinsa Usados** (`https://veinsausados.com/`)
6. **Honda Costa Rica - Faco** (`https://www.hondacostarica.com/autos-usados`)
7. **Grupo Q Usados** (`https://grupoqusadoscr.com/`)
8. **Top Cars CR** (`https://topcarscr.com/`)
9. **K-Autos CR** (`https://kautoscr.com/autos-usados/`)
10. **StarCars CR** (`https://starcars.com/`)
11. **Chito Cars** (`https://chitocars.com/vehiculos.php`)
12. **Parque Automotriz** (`https://www.parqueautomotriz.com/catalogo`)
13. **Quality Motors Usados** (`https://qualitymotorsusados.com/vehiculos/`)

## Cómo Ejecutar Localmente

1. Instalar dependencias (si aún no están instaladas):
   ```bash
   npm install
   ```
2. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```
3. Abrir en el navegador:
   ```
   http://localhost:3000
   ```

## Cómo Agregar una Nueva Agencia

El sistema utiliza el patrón adaptador (`AgencyScraper`):

1. Crea un archivo en `src/scrapers/agencies/<id-agencia>.ts` exportando un objeto que implemente la interfaz `AgencyScraper` (definida en `src/types/vehicle.ts`).
2. Registra los metadatos de la agencia (`id`, `name`, `baseUrl`, `color`) en el arreglo `AGENCIES` dentro de `src/types/vehicle.ts`.
3. Importa tu nuevo scraper y agrégalo al arreglo `SCRAPERS` en `src/scrapers/index.ts`.
