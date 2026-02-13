package com.collab.backend.websocket;

import com.collab.backend.service.UserService;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
@AllArgsConstructor
public class WebSocketEventListener {

    private static final Logger logger =
            LoggerFactory.getLogger(WebSocketEventListener.class);

    private final UserService userService;

    @EventListener
    public void handleWebSocketConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor =
                StompHeaderAccessor.wrap(event.getMessage());

        String simpSessionId = accessor.getSessionId();

        logger.info("WebSocket connected. simpSessionId={}", simpSessionId);
    }

    @EventListener
    public void handleWebSocketDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor =
                StompHeaderAccessor.wrap(event.getMessage());

        String simpSessionId = accessor.getSessionId();

        logger.info("WebSocket disconnected. simpSessionId={}", simpSessionId);

        if (simpSessionId != null) {
            // Use the same removal logic as an explicit LEAVE event:
            // this will decrement the room user count and, if this
            // was the last user, flush Redis → PostgreSQL and clear
            // the Redis room key to avoid data loss.
            userService.removeUserFromRoom(simpSessionId);
        }
    }
}
