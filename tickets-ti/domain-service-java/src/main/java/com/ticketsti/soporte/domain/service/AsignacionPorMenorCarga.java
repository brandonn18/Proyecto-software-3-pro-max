package com.ticketsti.soporte.domain.service;

import com.ticketsti.soporte.domain.model.Tecnico;
import com.ticketsti.soporte.domain.vo.CargaTecnico;
import java.util.Collection;
import java.util.Comparator;
import java.util.Map;
import java.util.Optional;

/**
 * Política por defecto (regla confirmada por el grupo): el candidato con menos tickets vigentes en la categoría;
 * en empate, el de menor nombre de usuario.
 */
public class AsignacionPorMenorCarga implements PoliticaAsignacion {

    @Override
    public Optional<Tecnico> elegir(Collection<Tecnico> candidatos, Map<String, CargaTecnico> carga) {
        return candidatos.stream().min(Comparator
                .comparingLong((Tecnico t) -> PoliticaAsignacion.cargaDe(t, carga).vigentes())
                .thenComparing(Tecnico::getUsername));
    }
}
