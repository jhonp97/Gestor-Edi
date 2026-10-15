# Eliminación de camiones

En la ficha del camión, pulsá **Eliminar** y revisá la confirmación antes de aceptar.

La eliminación es irreversible y borra el camión y sus transacciones, kilometrajes e historial operativo. No borra las nóminas ni los días de pago de los empleados, y no elimina los datos de otros camiones. Si un empleado compartió una jornada entre varios camiones, los porcentajes originales de los camiones restantes no se redistribuyen.

Si necesitás conservar el historial, cancelá la eliminación y cambiá el estado del camión a inactivo.

## Contrato de la API

`DELETE /api/trucks/{id}` requiere autenticación y pertenencia a la organización. Para eliminar un camión con historial operativo vinculado, enviá `Content-Type: application/json` y:

```json
{ "confirmHistoryDeletion": true }
```

Sin esa confirmación, un camión con historial devuelve `409` y el código `HISTORY_DELETION_CONFIRMATION_REQUIRED`, sin eliminar registros. Un camión sin jornadas operativas admite la petición existente sin cuerpo; sus transacciones y kilometrajes se eliminan igualmente según las relaciones de la base de datos. La interfaz pide confirmación en ambos casos.

Un cuerpo inválido devuelve `400`; un camión inexistente o ajeno a la organización devuelve `404`. Si los vínculos cambian durante la operación, la transacción revierte sus cambios y devuelve un conflicto `409` cuando corresponde. Las operaciones contenedoras de jornadas se conservan, incluso si quedan sin segmentos, para no borrar datos de pago de los empleados.

Estos cambios de código no eliminan registros existentes por sí solos. No pruebes la eliminación con datos que necesites conservar.
