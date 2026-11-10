package com.ticketsti.soporte;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

/** No hay usuarios locales: la identidad llega firmada por AuthCore, así que se excluye el usuario por defecto de Spring. */
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class DomainServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(DomainServiceApplication.class, args);
    }
}
