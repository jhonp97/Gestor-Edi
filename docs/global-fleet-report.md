# Resumen global de flota

En **Camiones → Informe de la flota → Resumen global de flota**, elige el mes de referencia, el período y los camiones. «Seleccionar todos» y «Limpiar selección» facilitan la selección; sin camiones seleccionados la descarga está desactivada. El PDF mensual y los filtros del informe anterior siguen siendo independientes.

La descarga usa `GET /api/trucks/report/global/pdf?month=2026-03&period=month&truck=id-a&truck=id-b`. El mes de referencia determina el mes, trimestre, semestre o año completo. La descarga muestra «Preparando PDF…» mientras espera y evita envíos duplicados. Si falla, muestra un aviso accesible para reintentar; una respuesta de error no se descarga como PDF.

## Cómo leerlo

- **Días-camión operativos:** pares camión/fecha distintos con jornadas registradas.
- **Fechas con actividad:** fechas distintas entre todos los camiones seleccionados.
- **Días únicos de trabajadores:** pares persona/fecha distintos, sin duplicar personas que trabajaron en varios camiones ese día.
- **Días equivalentes:** suma de los porcentajes de jornada seleccionados dividida entre 100.
- **Empresas:** agrupación de jornadas por el nombre registrado. Los días únicos de empresas distintas pueden solaparse; no se suman para reconstruir los días únicos globales.
- **Combustible:** importe monetario registrado de toda la selección y período, no litros ni gasto de una empresa concreta. No hay filtro por empresa ni atribución del combustible a clientes. Un importe cero no prueba que no hubiera consumo. La ausencia de jornadas registradas no acredita inactividad real.

Solo cuentan gastos cuya categoría, tras quitar espacios iniciales/finales y normalizar mayúsculas/minúsculas, sea exactamente **Combustible**. Por ejemplo, ` combustible ` y `COMBUSTIBLE` coinciden; `Gasóleo`, `Combustibles` o categorías aproximadas no se reinterpretan automáticamente.

El documento no contiene salarios. Usa A4 horizontal con resumen y tablas legibles: una selección pequeña cabe en una página; las selecciones grandes continúan en páginas adicionales, sin recortar filas ni reducir el texto para forzarlo a una sola hoja. Los encabezados y números de página ayudan a leer la continuación.
