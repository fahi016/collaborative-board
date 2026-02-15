package com.collab.backend.controller;

import com.collab.backend.dto.BoardActionMessage;
import com.collab.backend.dto.ChatMessageRequest;
import com.collab.backend.dto.ChatMessageResponse;
import com.collab.backend.dto.JoinRoomResponse;
import com.collab.backend.dto.UserMessage;
import com.collab.backend.dto.VoiceMicRequest;
import com.collab.backend.dto.VoiceSignalRequest;
import com.collab.backend.exception.RoomFullException;
import com.collab.backend.model.ActiveUser;
import com.collab.backend.model.Room;
import com.collab.backend.model.User;
import com.collab.backend.repository.RoomParticipantRepository;
import com.collab.backend.repository.UserRepository;
import com.collab.backend.service.*;
import jakarta.validation.Valid;
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
import java.util.stream.Collectors;


@Controller
@AllArgsConstructor
public class WebSocketController {
    private static final Logger logger = LoggerFactory.getLogger(WebSocketController.class);

    private SimpMessagingTemplate messagingTemplate;
    private BoardService boardService;
    private UserService userService;
    private final BoardRedisService boardRedisService;
    private final UserRepository userRepository;
    private final RoomParticipantService roomParticipantService;
    private final RoomService roomService;
    private final VoiceSignalingService voiceSignalingService;
    private final ChatService chatService;



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
        validatePrincipal(principal);
        validateRoomId(roomId);

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

            User user = userRepository.findByEmail(username)
                    .orElseThrow(()-> new IllegalStateException("User not found: " + username));
            Room room = roomService.getRoomById(roomId);
            roomParticipantService.addOrUpdateParticipant(room, user);

            messagingTemplate.convertAndSendToUser(
                    principal.getName(),
                    "/queue/join-confirmation",
                    Map.of(
                            "type", "join-confirmation",
                            "sessionId", response.getSessionId(),
                            "userName", response.getUserName(),
                            "color", response.getUserColor()
                    )
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

        } catch (IllegalStateException e) {
            // Handle specific case: user already active in another room
            logger.warn("User {} cannot join room {}: {}", principal.getName(), roomId, e.getMessage());
            
            // Send error message directly to the user
            messagingTemplate.convertAndSendToUser(
                    principal.getName(),
                    "/queue/errors",
                    (Object) Map.of(
                            "type", "error",
                            "message", e.getMessage(),
                            "roomId", roomId
                    )
            );
            
            // Return null to prevent broadcasting to the room topic
            return null;
        } catch (RoomFullException e) {
            // Handle room full exception
            logger.warn("User {} cannot join room {}: {}", principal.getName(), roomId, e.getMessage());
            
            // Send error message directly to the user
            messagingTemplate.convertAndSendToUser(
                    principal.getName(),
                    "/queue/errors",
                    (Object) Map.of(
                            "type", "error",
                            "message", e.getMessage(),
                            "roomId", roomId
                    )
            );
            
            // Return null to prevent broadcasting to the room topic
            return null;
        } catch (Exception e) {
            logger.error("Error handling user join", e);
            
            // Send error message to the user
            messagingTemplate.convertAndSendToUser(
                    principal.getName(),
                    "/queue/errors",
                    (Object) Map.of(
                            "type", "error",
                            "message", "Failed to join room: " + e.getMessage(),
                            "roomId", roomId
                    )
            );
            
            // Return null to prevent broadcasting to the room topic
            return null;
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

        validatePrincipal(principal);
        validateRoomId(roomId);

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
            @Valid BoardActionMessage message,
            Principal principal,
            StompHeaderAccessor accessor
    ) {

        validatePrincipal(principal);
        validateRoomId(roomId);

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
            @Valid BoardActionMessage message,
            Principal principal,
            StompHeaderAccessor accessor
    ) {

        validatePrincipal(principal);
        validateRoomId(roomId);

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
            @Valid BoardActionMessage message,
            Principal principal,
            StompHeaderAccessor accessor
    ) {

        validatePrincipal(principal);
        validateRoomId(roomId);

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

    private void validatePrincipal(Principal principal) {
        if (principal == null) {
            throw new IllegalStateException("Unauthenticated user");
        }
    }

    private void validateRoomId(String roomId) {
        if (roomId == null || roomId.isBlank() || roomId.length() > 36) {
            throw new IllegalArgumentException("Invalid roomId");
        }
    }


    // Handler: relay WebRTC signaling
    @MessageMapping("/room/{roomId}/voice/signal")
    public void handleVoiceSignal(
            @DestinationVariable String roomId,
            @Valid VoiceSignalRequest request,
            Principal principal,
            StompHeaderAccessor accessor) {
        validatePrincipal(principal);
        validateRoomId(roomId);
        String sessionId = accessor.getSessionId();
        if (!userService.isSessionInRoom(roomId, sessionId)) {
            throw new IllegalStateException("User not in room");
        }
        try {
            voiceSignalingService.relaySignal(roomId, sessionId, principal.getName(), request);
        } catch (IllegalArgumentException e) {
            logger.warn("Voice signal rejected: {}", e.getMessage());
            messagingTemplate.convertAndSendToUser(
                    principal.getName(),
                    "/queue/errors",
                    (Object) Map.of("type", "error", "message", e.getMessage(), "roomId", roomId));
        }
    }

        /**
     * Handle chat message in a room.
     * Client sends to: /app/room/{roomId}/chat
     * Broadcasts to: /topic/room/{roomId}/chat
     */
    @MessageMapping("/room/{roomId}/chat")
    @SendTo("/topic/room/{roomId}/chat")
    public ChatMessageResponse handleChat(
            @DestinationVariable String roomId,
            @Valid ChatMessageRequest request,
            Principal principal,
            StompHeaderAccessor accessor
    ) {
        validatePrincipal(principal);
        validateRoomId(roomId);
        String sessionId = accessor.getSessionId();
        if (!userService.isSessionInRoom(roomId, sessionId)) {
            throw new IllegalStateException("User not in room");
        }
        logger.debug("Chat message received roomId={} from {}", roomId, principal.getName());
        return chatService.sendMessage(roomId, principal.getName(), request.getContent());
    }

    // Handler: broadcast mic on/off to room (so everyone can show mute state)
    @MessageMapping("/room/{roomId}/voice/mic")
    @SendTo("/topic/room/{roomId}/users")
    public Map<String, Object> handleVoiceMic(
            @DestinationVariable String roomId,
            @Valid VoiceMicRequest request,
            Principal principal,
            StompHeaderAccessor accessor) {
        validatePrincipal(principal);
        validateRoomId(roomId);
        String sessionId = accessor.getSessionId();
        if (!userService.isSessionInRoom(roomId, sessionId)) {
            throw new IllegalStateException("User not in room");
        }
        logger.debug("Voice mic roomId={} user={} muted={}", roomId, principal.getName(), request.getMuted());
        return Map.of(
                "type", "voice-mic",
                "sessionId", sessionId,
                "userName", principal.getName(),
                "muted", request.getMuted());
    }
}
