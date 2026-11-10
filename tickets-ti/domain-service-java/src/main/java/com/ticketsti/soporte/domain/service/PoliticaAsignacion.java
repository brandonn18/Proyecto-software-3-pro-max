package com.ticketsti.soporte.domain.service;

import com.ticketsti.soporte.domain.model.Tecnico;
import java.util.Collection;
import java.util.Comparator;
import java.util.Map;
import java.util.Optional;

/** Quién atiende un ticket nuevo: el candidato con menos tickets abiertos; en empate, el de menor nombre de usuario. */
public class PoliticaAsignacion {

    public Optional<Tecnico> elegir(Collection<Tecnico> candidatos, Map<String, Long> abiertosPorTecnico) {
        return candidatos.stream().min(Comparator
                .comparingLong((Tecnico t) -> abiertosPorTecnico.getOrDefault(t.getUsername(), 0L))
                .thenComparing(Tecnico::getUsername));
    }
}
