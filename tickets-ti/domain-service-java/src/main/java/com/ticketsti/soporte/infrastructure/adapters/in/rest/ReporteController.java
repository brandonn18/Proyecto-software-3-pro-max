package com.ticketsti.soporte.infrastructure.adapters.in.rest;

import com.ticketsti.soporte.application.port.in.ReporteUseCase;
import com.ticketsti.soporte.infrastructure.adapters.in.rest.dto.CumplimientoSlaResponse;
import com.ticketsti.soporte.infrastructure.adapters.in.rest.dto.DesempenoTecnicoResponse;
import com.ticketsti.soporte.infrastructure.adapters.in.rest.dto.ResumenResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** M-03 (RF-12): reportes de gestión, solo ADMIN. El permiso lo decide el caso de uso (PoliticaAcceso), no este controlador. */
@RestController
@RequestMapping("/api/reportes")
public class ReporteController {

    private final ReporteUseCase reportes;

    public ReporteController(ReporteUseCase reportes) {
        this.reportes = reportes;
    }

    @GetMapping("/resumen")
    public ResumenResponse resumen() {
        return ResumenResponse.de(reportes.resumen(ActorActual.obtener()));
    }

    @GetMapping("/sla")
    public CumplimientoSlaResponse cumplimientoSla() {
        return CumplimientoSlaResponse.de(reportes.cumplimientoSla(ActorActual.obtener()));
    }

    @GetMapping("/tecnicos")
    public List<DesempenoTecnicoResponse> desempenoTecnicos() {
        return reportes.desempenoTecnicos(ActorActual.obtener()).stream().map(DesempenoTecnicoResponse::de).toList();
    }
}
