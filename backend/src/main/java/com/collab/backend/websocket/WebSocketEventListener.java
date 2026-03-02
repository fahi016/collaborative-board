package com.collab.backend.websocket;

import com.collab.backend.model.ActiveUser;
import com.collab.backend.service.UserService;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@AllArgsConstructor
public class WebSocketEventListener {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketEventListener.class);
    private final UserService userService;
    private final SimpMessagingTemplate messagingTemplate;

    @EventListener
    public void handleWebSocketConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        logger.info("WebSocket connected. simpSessionId={}", accessor.getSessionId());
    }

    @Async
    @EventListener
    public void handleWebSocketDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String simpSessionId = accessor.getSessionId();

        if (simpSessionId == null) return;

        logger.debug("WebSocket disconnected. simpSessionId={}", simpSessionId);

        try {
            String roomId = userService.removeUserFromRoom(simpSessionId);
            // Only broadcast if WE did the cleanup — not if REST already handled it
            if (roomId != null) {
                sendUserList(roomId);
            }
        } catch (Exception e) {
            logger.warn("Disconnect cleanup for session={}: {}", simpSessionId, e.getMessage());
        }
    }

    private void sendUserList(String roomId) {
        try {
            List<ActiveUser> users = userService.getUsersInRoom(roomId);
            List<Map<String, Object>> userList = users.stream()
                    .map(u -> Map.<String, Object>of(
                            "userName", u.getUserName(),
                            "color", u.getColor(),
                            "sessionId", u.getSessionId()))
                    .collect(Collectors.toList());
            messagingTemplate.convertAndSend(
                    "/topic/room/" + roomId + "/users",
                    (Object) Map.of("type", "user-list", "users", userList));
        } catch (Exception e) {
            logger.error("Error sending user list for room {} after disconnect", roomId, e);
        }
    }
}
