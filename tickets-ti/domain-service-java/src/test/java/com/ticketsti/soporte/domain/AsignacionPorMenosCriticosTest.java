package com.ticketsti.soporte.domain;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.domain.model.Tecnico;
import com.ticketsti.soporte.domain.service.AsignacionPorMenorCarga;
import com.ticketsti.soporte.domain.service.AsignacionPorMenosCriticos;
import com.ticketsti.soporte.domain.service.PoliticaAsignacion;
import com.ticketsti.soporte.domain.vo.CargaTecnico;
import com.ticketsti.soporte.domain.vo.Categoria;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** M-07: segunda política de asignación (Strategy). Prioriza a quien tenga menos tickets CRITICA vigentes. */
class AsignacionPorMenosCriticosTest {

    private final PoliticaAsignacion menosCriticos = new AsignacionPorMenosCriticos();

    private static Tecnico tec(String usuario) {
        return Tecnico.reconstruir(1L, usuario, List.of(Categoria.de("hardware")));
    }

    private String elegido(PoliticaAsignacion politica, Map<String, CargaTecnico> carga, String... candidatos) {
        return politica.elegir(List.of(candidatos).stream().map(AsignacionPorMenosCriticosTest::tec).toList(), carga)
                .orElseThrow().getUsername();
    }

    @Test
    @DisplayName("Elige al de menos críticos aunque tenga más carga total")
    void menosCriticosAunqueTengaMasCarga() {
        var carga = Map.of("ana", new CargaTecnico(1, 1), "beto", new CargaTecnico(3, 0));
        assertEquals("beto", elegido(menosCriticos, carga, "ana", "beto"));
    }

    @Test
    @DisplayName("Con los mismos críticos, desempata la menor carga; después, el nombre menor")
    void desempates() {
        var mismaCantidadDeCriticos = Map.of("ana", new CargaTecnico(4, 1), "beto", new CargaTecnico(2, 1));
        assertEquals("beto", elegido(menosCriticos, mismaCantidadDeCriticos, "ana", "beto"));

        var todoIgual = Map.of("carla", new CargaTecnico(2, 1), "beto", new CargaTecnico(2, 1));
        assertEquals("beto", elegido(menosCriticos, todoIgual, "carla", "beto"));
    }

    @Test
    @DisplayName("Quien no aparece en la carga no tiene tickets; sin candidatos no hay asignación")
    void sinCargaYSinCandidatos() {
        assertEquals("beto", elegido(menosCriticos, Map.of("ana", new CargaTecnico(1, 1)), "ana", "beto"));
        assertTrue(menosCriticos.elegir(List.of(), Map.of()).isEmpty());
    }

    @Test
    @DisplayName("Con los mismos datos, cada política decide distinto: es lo que permite el patrón Strategy")
    void lasPoliticasSonIntercambiables() {
        var carga = Map.of("ana", new CargaTecnico(1, 1), "beto", new CargaTecnico(3, 0));
        assertEquals("ana", elegido(new AsignacionPorMenorCarga(), carga, "ana", "beto"));
        assertEquals("beto", elegido(menosCriticos, carga, "ana", "beto"));
    }
}
