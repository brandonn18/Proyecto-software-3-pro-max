package com.ticketsti.soporte.application.reporte;

/**
 * Desempeño de un técnico (M-03). Los tickets terminados cuentan para el técnico que los tenía asignados al terminar.
 *
 * @param vigentes                  tickets vigentes asignados hoy
 * @param cumplimiento              sus tickets terminados, dentro y fuera del plazo
 * @param minutosPromedioResolucion promedio desde el inicio del plazo hasta la resolución; null si no resolvió ninguno
 */
public record DesempenoTecnico(String tecnico, long vigentes, Cumplimiento cumplimiento, Long minutosPromedioResolucion) { }
