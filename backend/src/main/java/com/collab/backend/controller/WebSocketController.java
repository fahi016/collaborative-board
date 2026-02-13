package com.collab.backend.controller;

import com.collab.backend.dto.BoardActionMessage;
import com.collab.backend.dto.JoinRoomResponse;
import com.collab.backend.dto.UserMessage;
import com.collab.backend.model.ActiveUser;
import com.collab.backend.service.BoardRedisService;
import com.collab.backend.service.BoardService;
import com.collab.backend.service.UserService;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;


@Controller
@AllArgsConstructor
public class WebSocketController {
    private static final Logger logger = LoggerFactory.getLogger(WebSocketController.class);

    private SimpMessagingTemplate messagingTemplate;
    private BoardService boardService;
    private UserService userService;
    private final BoardRedisService boardRedisService;


    /**
     * Handle user joining a room
     * Client sends to: /app/room/{roomId}/join
     * Broadcasts to: /topic/room/{roomId}/users
     */

    @MessageMapping("/room/{roomId}/join")
    @SendTo("/topic/room/{roomId}/users")
    public UserMessage handleUserJoin(
            @DestinationVariable String roomId,
            Principal principal,
            StompHeaderAccessor accessor
    ){
        if (principal == null) {
            logger.warn("Unauthenticated user attempted to join room {}", roomId);
            throw new IllegalStateException("Unauthenticated user");
        }

        logger.info("User joining room {}: {}", roomId, principal.getName());

        try{
            String username = principal.getName();
            String sessionId = accessor.getSessionId();
            // Add user to room
            JoinRoomResponse response = userService.joinAuthenticatedUser(
                    roomId,
                    username,
                    sessionId
            );



            // Also send updated user list
            sendUserList(roomId);

            // Send board history to joining user only
            List<Object> history = boardRedisService.getAllActions(roomId);

            if (history != null && !history.isEmpty()) {
                messagingTemplate.convertAndSendToUser(
                        principal.getName(),
                        "/queue/history",
                        history
                );
            } else {
                var boardState = boardService.getBoardState(roomId, 1);

                if (boardState != null && boardState.getCanvasData() != null) {
                    messagingTemplate.convertAndSendToUser(
                            principal.getName(),
                            "/queue/history",
                            boardState.getCanvasData()
                    );
                }
            }


            return new UserMessage(
                    "join",
                    response.getUserName(),
                    response.getSessionId(),
                    response.getUserColor()
            );

        } catch (Exception e) {
            logger.error("Error handling user join", e);
            throw e;
        }
    }

    /**
     * Handle user leaving a room
     * Client sends to: /app/room/{roomId}/leave
     * Broadcasts to: /topic/room/{roomId}/users
     */
    @MessageMapping("/room/{roomId}/leave")
    @SendTo("/topic/room/{roomId}/users")
    public UserMessage handleUserLeave(
            @DestinationVariable String roomId,
            Principal principal,
            StompHeaderAccessor accessor

    ){

        logger.info("User leaving room {}: {}", roomId, principal.getName());
        try{

            String sessionId = accessor.getSessionId();
            String username = principal.getName();

            // Remove user from room

            userService.removeUserFromRoom(sessionId);


            // Prepare leave message
            UserMessage leaveMessage = new UserMessage(
                    "leave",
                    principal.getName(),
                    sessionId,
                    null
            );
            // Also send updated user list
            sendUserList(roomId);

            return leaveMessage;

        } catch (Exception e) {
            logger.error("Error handling user leave", e);
            throw e;
        }
    }


    /**
     * Handle draw action
     * Client sends to: /app/board/{roomId}/draw
     * Broadcasts to: /topic/room/{roomId}
     */
    @MessageMapping("/board/{roomId}/draw")
    @SendTo("/topic/room/{roomId}")
    public BoardActionMessage handleDraw(
            @DestinationVariable String roomId,
            BoardActionMessage message,
            Principal principal,
            StompHeaderAccessor accessor
    ) {

        if (principal == null) {
            throw new IllegalStateException("Unauthenticated user");
        }

        String sessionId = accessor.getSessionId();

        if (!userService.isSessionInRoom(roomId, sessionId)) {
            throw new IllegalStateException("User not in room");
        }

        logger.debug("Draw action in room {} by {}", roomId, principal.getName());
        boardRedisService.saveAction(roomId, message);


        return message;
    }


    /**
     * Handle text action
     * Client sends to: /app/board/{roomId}/text
     * Broadcasts to: /topic/room/{roomId}
     */
    @MessageMapping("/board/{roomId}/text")
    @SendTo("/topic/room/{roomId}")
    public BoardActionMessage handleText(
            @DestinationVariable String roomId,
            BoardActionMessage message,
            Principal principal,
            StompHeaderAccessor accessor
    ) {

        if (principal == null) {
            throw new IllegalStateException("Unauthenticated user");
        }

        String sessionId = accessor.getSessionId();

        if (!userService.isSessionInRoom(roomId, sessionId)) {
            throw new IllegalStateException("User not in room");
        }

        logger.debug("Text action in room {} by {}", roomId, principal.getName());
        boardRedisService.saveAction(roomId, message);


        return message;
    }



    /**
     * Handle erase action
     * Client sends to: /app/board/{roomId}/erase
     * Broadcasts to: /topic/room/{roomId}
     */
    @MessageMapping("/board/{roomId}/erase")
    @SendTo("/topic/room/{roomId}")
    public BoardActionMessage handleErase(
            @DestinationVariable String roomId,
            BoardActionMessage message,
            Principal principal,
            StompHeaderAccessor accessor
    ) {

        if (principal == null) {
            throw new IllegalStateException("Unauthenticated user");
        }

        String sessionId = accessor.getSessionId();

        if (!userService.isSessionInRoom(roomId, sessionId)) {
            throw new IllegalStateException("User not in room");
        }

        logger.debug("Erase action in room {} by {}", roomId, principal.getName());
        boardRedisService.saveAction(roomId, message);


        return message;
    }


    private void sendUserList(String roomId) {
        try {
            List<ActiveUser> users = userService.getUsersInRoom(roomId);

            List<Map<String, Object>> userList = users.stream()
                    .map(user -> Map.of(
                            "userName", (Object) user.getUserName(),
                            "color", user.getColor(),
                            "sessionId", user.getSessionId()
                    ))
                    .collect(Collectors.toList());

            messagingTemplate.convertAndSend(
                    "/topic/room/" + roomId + "/users",
                    (Object) Map.of(
                            "type", "user-list",
                            "users", userList
                    )
            );

        } catch (Exception e) {
            logger.error("Error sending user list", e);
        }
    }


}
