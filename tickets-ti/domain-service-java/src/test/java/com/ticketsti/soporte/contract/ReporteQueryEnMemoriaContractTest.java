package com.ticketsti.soporte.contract;

import com.ticketsti.soporte.application.port.out.ReporteQueryPort;
import com.ticketsti.soporte.application.port.out.TicketRepositoryPort;
import com.ticketsti.soporte.testsupport.ReporteQueryEnMemoria;
import com.ticketsti.soporte.testsupport.TicketRepositoryEnMemoria;

class ReporteQueryEnMemoriaContractTest extends ReporteQueryContractTest {

    private final TicketRepositoryEnMemoria tickets = new TicketRepositoryEnMemoria();
    private final ReporteQueryEnMemoria reportes = new ReporteQueryEnMemoria(tickets);

    @Override protected TicketRepositoryPort tickets() { return tickets; }

    @Override protected ReporteQueryPort reportes() { return reportes; }
}
