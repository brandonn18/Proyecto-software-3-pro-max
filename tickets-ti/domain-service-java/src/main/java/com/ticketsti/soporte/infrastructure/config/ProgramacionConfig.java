package com.ticketsti.soporte.infrastructure.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Activa los adaptadores de entrada programados ({@code @Scheduled}), como la verificación de SLA (M-01). */
@Configuration
@EnableScheduling
public class ProgramacionConfig {
}
