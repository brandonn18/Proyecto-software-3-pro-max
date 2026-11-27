package com.ticketsti.soporte.domain.service;

import com.ticketsti.soporte.domain.model.Tecnico;
import com.ticketsti.soporte.domain.vo.CargaTecnico;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;

/**
 * Quién atiende un ticket nuevo (M-07, patrón Strategy). {@code TicketService} solo conoce esta interfaz: cambiar de
 * política, o agregar otra, no toca el servicio (OCP). La política por defecto es {@link AsignacionPorMenorCarga}, la
 * regla confirmada por el grupo; {@link AsignacionPorMenosCriticos} es la alternativa.
 */
public interface PoliticaAsignacion {

    /**
     * @param candidatos técnicos que atienden la categoría del ticket
     * @param carga      carga de cada candidato en esa categoría; quien no aparece no tiene tickets vigentes
     * @return el elegido, o vacío si no hay candidatos
     */
    Optional<Tecnico> elegir(Collection<Tecnico> candidatos, Map<String, CargaTecnico> carga);

    /** La carga de un candidato; {@link CargaTecnico#SIN_CARGA} si no figura. */
    static CargaTecnico cargaDe(Tecnico tecnico, Map<String, CargaTecnico> carga) {
        return carga.getOrDefault(tecnico.getUsername(), CargaTecnico.SIN_CARGA);
    }
}
