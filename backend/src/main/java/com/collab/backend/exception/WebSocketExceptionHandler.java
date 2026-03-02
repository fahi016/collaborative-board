package com.collab.backend.exception;

import com.collab.backend.controller.WebSocketController.EvictedSessionException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.web.bind.annotation.ControllerAdvice;

import java.util.Map;

@ControllerAdvice
public class WebSocketExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketExceptionHandler.class);

    /**
     * FIX: Silently swallow EvictedSessionException — these come from ghost sessions
     * that are physically still connected but have already been removed from the
     * active_user table. We don't want to log WARN noise or send an error frame
     * back to a dying connection (which would trigger frontend reconnect loops).
     */
    @MessageExceptionHandler(EvictedSessionException.class)
    public void handleEvictedSession(EvictedSessionException ex) {
        // Intentionally empty — ghost drain, nothing to do.
        logger.debug("EvictedSessionException swallowed: {}", ex.getMessage());
    }

    @MessageExceptionHandler(IllegalStateException.class)
    @SendToUser("/queue/errors")
    public Map<String, Object> handleStateException(IllegalStateException ex) {
        logger.warn("WebSocket state error: {}", ex.getMessage());
        return Map.of("type", "error", "message", ex.getMessage());
    }

    @MessageExceptionHandler(IllegalArgumentException.class)
    @SendToUser("/queue/errors")
    public Map<String, Object> handleArgException(IllegalArgumentException ex) {
        logger.warn("WebSocket arg error: {}", ex.getMessage());
        return Map.of("type", "error", "message", ex.getMessage());
    }

    @MessageExceptionHandler(Exception.class)
    @SendToUser("/queue/errors")
    public Map<String, Object> handleGenericException(Exception ex) {
        logger.error("WebSocket unexpected error", ex);
        return Map.of("type", "error", "message", "An unexpected error occurred");
    }
}