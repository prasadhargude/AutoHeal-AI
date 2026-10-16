# ==============================================================================
# Web Service — Multi-stage Dockerfile
# Stage 1: Build JAR using Maven and Temurin JDK 21 Alpine
# Stage 2: Run lightweight container using Temurin JRE 21 Alpine
# ==============================================================================

# --- Stage 1: Build ---
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /build

# Cache Maven dependencies layer
COPY pom.xml ./
RUN mvn dependency:go-offline -B

# Copy application source code
COPY src ./src

# Build production jar without tests (tests can run in CI)
RUN mvn clean package -DskipTests -B

# --- Stage 2: Runtime ---
FROM eclipse-temurin:21-jre-alpine AS runner

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create non-root system user
RUN adduser -D -u 1000 spring

WORKDIR /app

# Copy executable jar from builder stage
COPY --from=builder /build/target/*.jar app.jar
RUN chown -R spring:spring /app

USER spring

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=3 --start-period=15s \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
