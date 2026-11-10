package com.ticketsti.soporte.infrastructure.adapters.in.rest;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Sonda de salud pública (sin token) para el balanceador o la plataforma de despliegue. No toca la base de datos. */
@RestController
@RequestMapping("/api/health")
public class HealthController {

    @GetMapping
    public Map<String, String> salud() {
        return Map.of("status", "UP");
    }
}
