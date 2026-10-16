# Resumen global de flota

En **Camiones → Informe de la flota → Resumen global de flota**, elige el mes de referencia, el período y los camiones. «Seleccionar todos» y «Limpiar selección» facilitan la selección; sin camiones seleccionados la descarga está desactivada. El PDF mensual y los filtros del informe anterior siguen siendo independientes.

La descarga usa `GET /api/trucks/report/global/pdf?month=2026-03&period=month&truck=id-a&truck=id-b`. El mes de referencia determina el mes, trimestre, semestre o año completo. La descarga muestra «Preparando PDF…» mientras espera y evita envíos duplicados. Si falla, muestra un aviso accesible para reintentar; una respuesta de error no se descarga como PDF.

## Cómo leerlo

- **Días-camión operativos:** pares camión/fecha distintos con jornadas registradas.
- **Fechas con actividad:** fechas distintas entre todos los camiones seleccionados.
- **Días únicos de trabajadores:** pares persona/fecha distintos, sin duplicar personas que trabajaron en varios camiones ese día.
- **Días equivalentes:** suma de los porcentajes de jornada seleccionados dividida entre 100.
- **Kilómetros (01 / Camiones):** suma de todos los kilómetros registrados por camión en el período seleccionado (el mes si se elige período mensual), incluidos registros manuales y jornadas de 200 km o menos. Aparece entre Días equivalentes y Combustible (€); muestra 0 cuando no hay registros. No es la diferencia entre lecturas del cuentakilómetros ni se limita a los días de la sección 04.
- **Empresas:** agrupación de jornadas por el nombre registrado. Los días únicos de empresas distintas pueden solaparse; no se suman para reconstruir los días únicos globales.
- **Combustible:** importe monetario registrado de toda la selección y período, no litros ni gasto de una empresa concreta. No hay filtro por empresa ni atribución del combustible a clientes. Un importe cero no prueba que no hubiera consumo. La ausencia de jornadas registradas no acredita inactividad real.

Solo cuentan gastos cuya categoría, tras quitar espacios iniciales/finales y normalizar mayúsculas/minúsculas, sea exactamente **Combustible**. Por ejemplo, ` combustible ` y `COMBUSTIBLE` coinciden; `Gasóleo`, `Combustibles` o categorías aproximadas no se reinterpretan automáticamente.

## Jornadas con más de 200 km

La sección **04 / Jornadas por camión con más de 200 km** comienza en la segunda página cuando las secciones 01–03 caben en la primera; si necesitan continuación, comienza en una nueva página después de ellas. Muestra fecha, matrícula, empresa y kilómetros, ordenados por fecha y matrícula, para la selección y período del informe.

Solo se incluyen valores estrictamente mayores que 200 km; exactamente 200 km no cuenta. Cada camión y fecha cuenta una vez: dos camiones en la misma fecha son dos días-camión. La empresa procede de la jornada vinculada al registro de kilometraje. Los registros manuales sin vínculo aparecen como **Sin empresa asociada**, con subtotal propio.

Al final del detalle, **Totales por empresa** cuenta los días-camión incluidos por empresa, no fechas únicas entre todos los camiones. El total coincide con las filas del detalle. Si no hay registros que superen el umbral, se muestra un aviso explícito. Esta sección no altera los días operativos ni los importes del resumen.

El documento no contiene salarios. Usa A4 horizontal con resumen y tablas legibles, con un mínimo de dos páginas. Las selecciones grandes continúan en páginas adicionales, sin recortar filas ni reducir el texto para forzarlo a una sola hoja. Los encabezados y números de página ayudan a leer la continuación.
