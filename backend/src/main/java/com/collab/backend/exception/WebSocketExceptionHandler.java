package com.collab.backend.exception;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.validation.BindException;
import org.springframework.web.bind.annotation.ControllerAdvice;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Central exception handling for STOMP @MessageMapping methods.
 * Sends structured error payloads to /user/queue/errors so clients can show them.
 * CONNECT-time errors (e.g. invalid JWT in JwtChannelInterceptor) close the connection
 * before a user session exists; those are not handled here.
 */
@ControllerAdvice
@RequiredArgsConstructor
public class WebSocketExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketExceptionHandler.class);

    @MessageExceptionHandler(IllegalArgumentException.class)
    @SendToUser(destinations = "/queue/errors", broadcast = false)
    public Map<String, Object> handleIllegalArgument(IllegalArgumentException ex, Principal principal) {
        logger.warn("WebSocket validation/argument error: {}", ex.getMessage());
        return errorPayload("BAD_REQUEST", ex.getMessage(), principal);
    }

    @MessageExceptionHandler(IllegalStateException.class)
    @SendToUser(destinations = "/queue/errors", broadcast = false)
    public Map<String, Object> handleIllegalState(IllegalStateException ex, Principal principal) {
        logger.warn("WebSocket state error: {}", ex.getMessage());
        return errorPayload("STATE_ERROR", ex.getMessage(), principal);
    }

    @MessageExceptionHandler(BindException.class)
    @SendToUser(destinations = "/queue/errors", broadcast = false)
    public Map<String, Object> handleValidation(BindException ex, Principal principal) {
        Map<String, String> fieldErrors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(err -> fieldErrors.put(err.getField(), err.getDefaultMessage()));
        logger.warn("WebSocket validation failed: {}", fieldErrors);
        Map<String, Object> payload = errorPayload("VALIDATION_ERROR", "Invalid message payload", principal);
        payload.put("fieldErrors", fieldErrors);
        return payload;
    }

    @MessageExceptionHandler(RoomFullException.class)
    @SendToUser(destinations = "/queue/errors", broadcast = false)
    public Map<String, Object> handleRoomFull(RoomFullException ex, Principal principal) {
        logger.warn("Room full: {}", ex.getMessage());
        return errorPayload("ROOM_FULL", ex.getMessage(), principal);
    }

    @MessageExceptionHandler(Exception.class)
    @SendToUser(destinations = "/queue/errors", broadcast = false)
    public Map<String, Object> handleGeneric(Exception ex, Principal principal) {
        logger.error("WebSocket error", ex);
        return errorPayload("INTERNAL_ERROR", "Something went wrong. Please try again.", principal);
    }

    private Map<String, Object> errorPayload(String code, String message, Principal principal) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "error");
        payload.put("code", code);
        payload.put("message", message);
        payload.put("timestamp", LocalDateTime.now().toString());
        if (principal != null) {
            payload.put("user", principal.getName());
        }
        return payload;
    }
}
