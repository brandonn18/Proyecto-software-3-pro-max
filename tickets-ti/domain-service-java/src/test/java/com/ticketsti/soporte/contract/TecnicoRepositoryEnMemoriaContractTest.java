package com.ticketsti.soporte.contract;

import com.ticketsti.soporte.application.port.out.TecnicoRepositoryPort;
import com.ticketsti.soporte.testsupport.TecnicoRepositoryEnMemoria;

/** El doble en memoria pasa los mismos contratos que el adaptador JPA: por eso es confiable para probar la aplicación. */
class TecnicoRepositoryEnMemoriaContractTest extends TecnicoRepositoryContractTest {
    private final TecnicoRepositoryEnMemoria repo = new TecnicoRepositoryEnMemoria();
    @Override protected TecnicoRepositoryPort repo() { return repo; }
}
