package com.ticketsti.soporte.application.service;

import com.ticketsti.soporte.application.port.in.ReporteUseCase;
import com.ticketsti.soporte.application.port.out.ReporteQueryPort;
import com.ticketsti.soporte.application.port.out.TecnicoRepositoryPort;
import com.ticketsti.soporte.application.reporte.*;
import com.ticketsti.soporte.domain.model.Actor;
import com.ticketsti.soporte.domain.model.EstadoTicket;
import com.ticketsti.soporte.domain.model.MedicionSla;
import com.ticketsti.soporte.domain.model.Prioridad;
import com.ticketsti.soporte.domain.model.Tecnico;
import com.ticketsti.soporte.domain.service.PoliticaAcceso;
import java.time.Clock;
import java.time.Instant;
import java.util.*;

/**
 * M-03 (RF-12). Permiso en {@link PoliticaAcceso} (solo ADMIN); qué es «vencido», «en riesgo» o «a tiempo», en
 * {@link MedicionSla}. Aquí solo se cuenta y se promedia sobre las filas del puerto de solo lectura.
 */
public class ReporteService implements ReporteUseCase {

    private static final String OPERACION = "ver los reportes";

    private final ReporteQueryPort reportes;
    private final TecnicoRepositoryPort tecnicos;
    private final Clock reloj;
    private final PoliticaAcceso acceso;

    public ReporteService(ReporteQueryPort reportes, TecnicoRepositoryPort tecnicos, Clock reloj, PoliticaAcceso acceso) {
        this.reportes = reportes;
        this.tecnicos = tecnicos;
        this.reloj = reloj;
        this.acceso = acceso;
    }

    @Override
    public ResumenTickets resumen(Actor actor) {
        acceso.asegurarAdmin(actor, OPERACION);
        Instant ahora = reloj.instant();
        List<FilaReporte> filas = reportes.filas();

        Map<EstadoTicket, Long> porEstado = ceros(EstadoTicket.class);
        Map<Prioridad, Long> porPrioridad = ceros(Prioridad.class);
        Map<String, Long> porCategoria = new TreeMap<>();
        long vigentes = 0, sinAsignar = 0, vencidos = 0;
        for (FilaReporte f : filas) {
            porEstado.merge(f.estado(), 1L, Long::sum);
            porPrioridad.merge(f.prioridad(), 1L, Long::sum);
            porCategoria.merge(f.categoria().nombre(), 1L, Long::sum);
            if (f.estado().estaVigente()) {
                vigentes++;
                if (f.tecnico() == null) sinAsignar++;
                if (MedicionSla.vencido(f.venceSla(), ahora)) vencidos++;
            }
        }
        return new ResumenTickets(ahora, filas.size(), vigentes, sinAsignar, vencidos,
                Collections.unmodifiableMap(porEstado), Collections.unmodifiableMap(porPrioridad),
                Collections.unmodifiableMap(porCategoria));
    }

    @Override
    public CumplimientoSla cumplimientoSla(Actor actor) {
        acceso.asegurarAdmin(actor, OPERACION);
        Instant ahora = reloj.instant();
        List<FilaReporte> filas = reportes.filas();

        Map<Prioridad, Cumplimiento> porPrioridad = new EnumMap<>(Prioridad.class);
        for (Prioridad p : Prioridad.values()) {
            porPrioridad.put(p, medir(filas.stream().filter(f -> f.prioridad() == p).toList()));
        }
        long vencidos = filas.stream()
                .filter(f -> f.estado().estaVigente() && MedicionSla.vencido(f.venceSla(), ahora)).count();
        long enRiesgo = filas.stream()
                .filter(f -> f.estado().estaVigente() && MedicionSla.enRiesgo(f.prioridad(), f.venceSla(), ahora)).count();
        return new CumplimientoSla(ahora, medir(filas), Collections.unmodifiableMap(porPrioridad), vencidos, enRiesgo);
    }

    @Override
    public List<DesempenoTecnico> desempenoTecnicos(Actor actor) {
        acceso.asegurarAdmin(actor, OPERACION);
        List<FilaReporte> filas = reportes.filas();

        // los registrados (aunque no tengan tickets) y cualquier otro que figure como técnico de un ticket
        Set<String> nombres = new TreeSet<>();
        tecnicos.listar().stream().map(Tecnico::getUsername).forEach(nombres::add);
        filas.stream().map(FilaReporte::tecnico).filter(Objects::nonNull).forEach(nombres::add);

        return nombres.stream()
                .map(u -> desempeno(u, filas.stream().filter(f -> u.equals(f.tecnico())).toList()))
                .toList();
    }

    private static DesempenoTecnico desempeno(String tecnico, List<FilaReporte> suyas) {
        long vigentes = suyas.stream().filter(f -> f.estado().estaVigente()).count();
        List<FilaReporte> terminadas = suyas.stream().filter(FilaReporte::terminado).toList();
        Long minutos = terminadas.isEmpty() ? null : Math.round(terminadas.stream()
                .mapToLong(f -> MedicionSla.tiempoDeResolucion(f.prioridad(), f.venceSla(), f.resueltoEn()).toSeconds())
                .average().orElse(0) / 60.0);
        return new DesempenoTecnico(tecnico, vigentes, medir(suyas), minutos);
    }

    /** Solo cuentan los terminados (resueltos o cerrados con su resolución registrada). */
    private static Cumplimiento medir(List<FilaReporte> filas) {
        long dentro = 0, fuera = 0;
        for (FilaReporte f : filas) {
            if (!f.terminado()) continue;
            if (MedicionSla.resueltoATiempo(f.resueltoEn(), f.venceSla())) dentro++;
            else fuera++;
        }
        return Cumplimiento.de(dentro, fuera);
    }

    private static <E extends Enum<E>> Map<E, Long> ceros(Class<E> tipo) {
        Map<E, Long> mapa = new EnumMap<>(tipo);
        for (E valor : tipo.getEnumConstants()) mapa.put(valor, 0L);
        return mapa;
    }
}
