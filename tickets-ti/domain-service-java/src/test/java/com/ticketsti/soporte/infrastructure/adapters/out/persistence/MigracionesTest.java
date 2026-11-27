package com.ticketsti.soporte.infrastructure.adapters.out.persistence;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationState;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

/**
 * M-04: el esquema lo crea Flyway y Hibernate solo lo valida ({@code ddl-auto: validate}). Si una entidad cambia sin su
 * migración, el contexto de esta prueba (y de todas las de Spring) no arranca.
 */
@DataJpaTest
class MigracionesTest {

    @Autowired
    private Flyway flyway;

    private static List<String> archivos(String base) throws IOException {
        Resource[] encontrados = new PathMatchingResourcePatternResolver().getResources("classpath:db/migration/" + base + "/*.sql");
        return Arrays.stream(encontrados).map(Resource::getFilename).sorted().toList();
    }

    @Test
    @DisplayName("Flyway aplicó todas las migraciones, en orden, y Hibernate validó el esquema resultante")
    void migracionesAplicadas() {
        List<MigrationInfo> aplicadas = Arrays.asList(flyway.info().applied());
        assertEquals(List.of("1", "2", "3"), aplicadas.stream().map(m -> m.getVersion().getVersion()).toList());
        assertTrue(aplicadas.stream().allMatch(m -> m.getState() == MigrationState.SUCCESS));
        assertEquals(0, flyway.info().pending().length);
    }

    @Test
    @DisplayName("H2 y MySQL tienen las mismas migraciones: ninguna se agregó a una sola base")
    void mismasMigracionesEnLasDosBases() throws IOException {
        List<String> h2 = archivos("h2");
        List<String> mysql = archivos("mysql");
        assertFalse(h2.isEmpty());
        assertEquals(h2, mysql);
    }
}
