package com.collab.backend.controller;

import com.collab.backend.dto.BoardActionMessage;
import com.collab.backend.dto.JoinRoomResponse;
import com.collab.backend.dto.UserMessage;
import com.collab.backend.model.ActiveUser;
import com.collab.backend.service.BoardService;
import com.collab.backend.service.UserService;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;


@Controller
@AllArgsConstructor
public class WebSocketController {
    private static final Logger logger = LoggerFactory.getLogger(WebSocketController.class);

    private SimpMessagingTemplate messagingTemplate;
    private BoardService boardService;
    private UserService userService;

    /**
     * Handle user joining a room
     * Client sends to: /app/room/{roomId}/join
     * Broadcasts to: /topic/room/{roomId}/users
     */

    @MessageMapping("/room/{roomId}/join")
    @SendTo("/topic/room/{roomId}/users")
    public UserMessage handleUserJoin(
            @DestinationVariable String roomId,
            UserMessage message
    ){
        logger.info("User joining room {}: {}", roomId, message.getUserName());

        try{
            // Add user to room
            JoinRoomResponse response = userService.joinRoom(
                    roomId,
                    message.getUserName(),
                    message.getSessionId()
            );

            UserMessage joinMessage = new UserMessage(
                    "join",
                    response.getUserName(),
                    response.getSessionId(),
                    response.getUserColor()
            );

            // Also send updated user list
            sendUserList(roomId);

            return joinMessage;

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
            UserMessage message
    ){

        logger.info("User leaving room {}: {}", roomId, message.getUserName());
        try{
            // Remove user from room
            userService.removeUserFromRoom(message.getSessionId());


            // Prepare leave message
            UserMessage leaveMessage = new UserMessage(
                    "leave",
                    message.getUserName(),
                    message.getSessionId(),
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
            BoardActionMessage message
    ) {
        logger.debug("Draw action in room {}", roomId);

        try {
            // Optionally persist the action (can be debounced on client side)
            // boardService.appendActionToBoardState(roomId, 1, message.getData());

            return message;
        } catch (Exception e) {
            logger.error("Error handling draw action", e);
            throw e;
        }
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
            BoardActionMessage message
    ) {
        logger.debug("Text action in room {}", roomId);

        try {
            // Optionally persist the action
            // boardService.appendActionToBoardState(roomId, 1, message.getData());

            return message;
        } catch (Exception e) {
            logger.error("Error handling text action", e);
            throw e;
        }
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
            BoardActionMessage message
    ) {
        logger.debug("Erase action in room {}", roomId);

        try {
            // Optionally persist the action
            // boardService.appendActionToBoardState(roomId, 1, message.getData());

            return message;
        } catch (Exception e) {
            logger.error("Error handling erase action", e);
            throw e;
        }
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
