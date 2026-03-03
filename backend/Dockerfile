# Stage 1: Build Stage
FROM maven:3.9.9-eclipse-temurin-17 AS builder

WORKDIR /app

# Copy pom first (for dependency caching)
COPY pom.xml .
RUN mvn dependency:go-offline

# Copy source code
COPY src ./src

# Build jar
RUN mvn clean package -DskipTests


# Stage 2: Runtime Stage
FROM eclipse-temurin:17-jdk-jammy

WORKDIR /app

# Copy jar from builder stage
COPY --from=builder /app/target/*.jar app.jar

# Expose port (Render uses 8080 internally)
EXPOSE 8080

# Run application
ENTRYPOINT ["java","-jar","app.jar"]