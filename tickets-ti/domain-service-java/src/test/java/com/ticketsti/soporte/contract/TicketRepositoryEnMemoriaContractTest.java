package com.ticketsti.soporte.contract;

import com.ticketsti.soporte.application.port.out.TicketRepositoryPort;
import com.ticketsti.soporte.testsupport.TicketRepositoryEnMemoria;

class TicketRepositoryEnMemoriaContractTest extends TicketRepositoryContractTest {
    private final TicketRepositoryEnMemoria repo = new TicketRepositoryEnMemoria();
    @Override protected TicketRepositoryPort repo() { return repo; }
}
