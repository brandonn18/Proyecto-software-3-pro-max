package com.ticketsti.soporte.infrastructure.adapters.out.persistence;

import static org.junit.jupiter.api.Assertions.*;

import com.ticketsti.soporte.application.port.in.TicketUseCase;
import com.ticketsti.soporte.application.port.in.command.CrearTicketCommand;
import com.ticketsti.soporte.testsupport.Datos;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Encoders;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.*;
import java.util.stream.LongStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * M-06: el consecutivo del código TKT-AAAA-NNNN bajo concurrencia, en la aplicación real (caso de uso → JPA → H2).
 * Antes era «máximo del año + 1»: dos creaciones simultáneas podían recibir el mismo número y una fallaba con 409.
 * La base es propia y empieza vacía, así que también se prueba la primera creación del año (todavía sin contador).
 */
@SpringBootTest
class CreacionConcurrenteTest {

    @DynamicPropertySource
    static void propiedades(DynamicPropertyRegistry registro) {
        registro.add("seguridad.jwt.secret-base64", () -> Encoders.BASE64.encode(Jwts.SIG.HS384.key().build().getEncoded()));
        registro.add("spring.datasource.url", () -> "jdbc:h2:mem:concurrencia;MODE=MySQL;DB_CLOSE_DELAY=-1");
        registro.add("negocio.sla.intervalo-verificacion", () -> "P1D");
    }

    @Autowired
    private TicketUseCase tickets;

    @Test
    @DisplayName("Cuatro hilos creando tickets a la vez: sin errores, sin códigos repetidos y sin huecos")
    void creacionesSimultaneas() throws Exception {
        int hilos = 4, porHilo = 15;
        ExecutorService pool = Executors.newFixedThreadPool(hilos);
        CountDownLatch largada = new CountDownLatch(1);
        List<Future<List<String>>> resultados = new ArrayList<>();
        for (int h = 0; h < hilos; h++) {
            resultados.add(pool.submit(() -> {
                largada.await();                                    // todos arrancan juntos
                List<String> codigos = new ArrayList<>();
                for (int i = 0; i < porHilo; i++) {
                    codigos.add(tickets.crear(Datos.usuario("maria"), new CrearTicketCommand("Sin red en la sala",
                            "No hay conexión en la sala de reuniones", "incidente", "redes", "media")).getCodigo());
                }
                return codigos;
            }));
        }
        largada.countDown();

        List<String> todos = new ArrayList<>();
        try {
            for (Future<List<String>> r : resultados) todos.addAll(r.get(60, TimeUnit.SECONDS));  // un error en un hilo falla aquí
        } finally {
            pool.shutdownNow();
        }

        assertEquals(hilos * porHilo, new HashSet<>(todos).size(), "hay códigos repetidos");
        List<Long> consecutivos = todos.stream().map(c -> Long.parseLong(c.substring(c.lastIndexOf('-') + 1))).sorted().toList();
        assertEquals(LongStream.rangeClosed(1, hilos * porHilo).boxed().toList(), consecutivos, "hay huecos en la numeración");
    }
}
