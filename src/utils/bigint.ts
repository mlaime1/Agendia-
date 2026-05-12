// BigInt no se serializa a JSON por defecto en JavaScript.
// Este patch global lo convierte a string automáticamente.
// Importar una sola vez en server.ts antes de todo.

(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};
