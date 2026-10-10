# ── Etapa 1: compilación con el wrapper de Gradle (Spring Boot 4 requiere Gradle 9) ──
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN sed -i 's/\r$//' gradlew && chmod +x gradlew && ./gradlew --no-daemon dependencies > /dev/null
COPY src ./src
RUN ./gradlew --no-daemon clean bootJar -x test

# ── Etapa 2: imagen final solo con el JRE ────────────────────────────────────
FROM eclipse-temurin:21-jre
WORKDIR /app

# curl solo para el HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system appgroup && useradd --system --gid appgroup appuser

COPY --from=build /app/build/libs/*.jar app.jar
USER appuser

EXPOSE 8081
# Fargate con 1 GB: la JVM usa como máximo el 75 % de la memoria del contenedor
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:8081/api/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
