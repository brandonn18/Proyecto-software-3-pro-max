// Errores que los adaptadores lanzan y los casos de uso saben manejar.

class ErrorIdDuplicado extends Error {
  constructor(id) {
    super(`Ya existe un ticket con id ${id}`);
    this.name = 'ErrorIdDuplicado';
    this.id = id;
  }
}

class ErrorDirectorioNoDisponible extends Error {
  constructor(causa) {
    super('El directorio de usuarios (authcore) no está disponible');
    this.name = 'ErrorDirectorioNoDisponible';
    this.causa = causa;
  }
}

module.exports = { ErrorIdDuplicado, ErrorDirectorioNoDisponible };
