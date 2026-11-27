package com.ticketsti.soporte.domain.service;

import com.ticketsti.soporte.domain.model.Tecnico;
import com.ticketsti.soporte.domain.vo.CargaTecnico;
import java.util.Collection;
import java.util.Comparator;
import java.util.Map;
import java.util.Optional;

/**
 * M-07, política alternativa: prioriza al candidato con menos tickets CRITICA vigentes en la categoría, para repartir
 * lo urgente. En empate, el de menos tickets vigentes; después, el de menor nombre de usuario.
 * Se activa con {@code negocio.asignacion.politica=menos-criticos}.
 */
public class AsignacionPorMenosCriticos implements PoliticaAsignacion {

    @Override
    public Optional<Tecnico> elegir(Collection<Tecnico> candidatos, Map<String, CargaTecnico> carga) {
        return candidatos.stream().min(Comparator
                .comparingLong((Tecnico t) -> PoliticaAsignacion.cargaDe(t, carga).criticos())
                .thenComparingLong(t -> PoliticaAsignacion.cargaDe(t, carga).vigentes())
                .thenComparing(Tecnico::getUsername));
    }
}
