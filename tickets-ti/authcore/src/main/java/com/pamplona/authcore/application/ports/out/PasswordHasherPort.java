package com.pamplona.authcore.application.ports.out;

/**
 * Puerto de salida: hashing y verificacion de contrasenas.
 */
public interface PasswordHasherPort {
    String hash(String rawPassword);
    boolean matches(String rawPassword, String hashedPassword);
}
