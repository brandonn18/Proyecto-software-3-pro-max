package com.pamplona.authcore.infrastructure.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Protege /internal/**: solo domain-service conoce AUTHCORE_INTERNAL_KEY.
 * La comparacion es en tiempo constante para no filtrar la clave por timing.
 */
@Component
public class InternalKeyFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Internal-Key";
    private static final int MIN_KEY_LENGTH = 32;

    private final byte[] internalKey;

    public InternalKeyFilter(@Value("${authcore.internal-key}") String internalKey) {
        if (internalKey == null || internalKey.length() < MIN_KEY_LENGTH) {
            throw new IllegalStateException("AUTHCORE_INTERNAL_KEY debe tener al menos " + MIN_KEY_LENGTH + " caracteres");
        }
        this.internalKey = internalKey.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/internal/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String received = request.getHeader(HEADER);
        if (received == null || !MessageDigest.isEqual(internalKey, received.getBytes(StandardCharsets.UTF_8))) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"error\":\"Clave interna invalida\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
