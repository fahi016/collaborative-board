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
import com.collab.backend.repository.UserRepository;
import com.collab.backend.service.*;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
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
     * FIX: Track evicted/superseded session IDs so that in-flight messages from
     * the old WebSocket connection (which is still physically open) are silently
     * dropped rather than logged as scary "User not in room" warnings and sending
     * error frames back to a dying connection.
     *
     * Entry lifecycle:
     *  - Added in handleUserJoin when a ghost session is evicted.
     *  - Removed in handleUserLeave when the old session finally sends its leave.
     *  - Also removed after EVICTED_SESSION_TTL_MS to avoid unbounded growth in
     *    the unlikely event the old connection never sends a leave.
     *
     * A ConcurrentHashMap<sessionId, evictedAtMs> is used (value = timestamp for TTL).
     */
    private static final long EVICTED_SESSION_TTL_MS = 60_000; // 1 minute
    private final Map<String, Long> evictedSessions = new ConcurrentHashMap<>();

    @MessageMapping("/room/{roomId}/join")
    public void handleUserJoin(
            @DestinationVariable String roomId,
            Principal principal,
            StompHeaderAccessor accessor) {

        validatePrincipal(principal);
        validateRoomId(roomId);

        String username = principal.getName();
        String sessionId = accessor.getSessionId();

        logger.info("User joining room={} user={} session={}", roomId, username, sessionId);

        try {
            // FIX: Capture which ghost session (if any) was evicted during this join,
            // so we can register it in evictedSessions for silent drain below.
            String evictedSessionId = userService.joinAuthenticatedUserAndGetEvictedSession(roomId, username, sessionId);

            if (evictedSessionId != null) {
                evictedSessions.put(evictedSessionId, System.currentTimeMillis());
                logger.debug("Registered evicted session={} for silent drain", evictedSessionId);
            }

            // Re-fetch the fresh join result (UserService already saved it)
            JoinRoomResponse response = userService.getActiveJoinResponse(roomId, username, sessionId);

            User user = userRepository.findByEmail(username)
                    .orElseThrow(() -> new IllegalStateException("User not found: " + username));
            Room room = roomService.getRoomById(roomId);
            roomParticipantService.addOrUpdateParticipant(room, user);

            messagingTemplate.convertAndSendToUser(
                    username,
                    "/queue/join-confirmation",
                    Map.of("type", "join-confirmation",
                            "sessionId", response.getSessionId(),
                            "userName", response.getUserName(),
                            "color", response.getUserColor())
            );

            sendUserList(roomId);

            List<Object> history = boardRedisService.getAllActions(roomId);
            if (history != null && !history.isEmpty()) {
                messagingTemplate.convertAndSendToUser(username, "/queue/history", history);
            } else {
                var boardState = boardService.getBoardState(roomId, 1);
                if (boardState != null && boardState.getCanvasData() != null) {
                    messagingTemplate.convertAndSendToUser(username, "/queue/history",
                            boardState.getCanvasData());
                }
            }

        } catch (IllegalStateException | RoomFullException e) {
            logger.warn("Join rejected user={} room={}: {}", username, roomId, e.getMessage());
            messagingTemplate.convertAndSendToUser(
                    username, "/queue/errors",
                    (Object) Map.of("type", "error", "message", e.getMessage(), "roomId", roomId)
            );
        } catch (Exception e) {
            logger.error("Unexpected error on join user={} room={}", username, roomId, e);
            messagingTemplate.convertAndSendToUser(
                    username, "/queue/errors",
                    (Object) Map.of("type", "error", "message", "Failed to join room", "roomId", roomId)
            );
        }
    }

    @MessageMapping("/room/{roomId}/leave")
    public void handleUserLeave(
            @DestinationVariable String roomId,
            Principal principal,
            StompHeaderAccessor accessor) {

        validatePrincipal(principal);
        validateRoomId(roomId);

        String sessionId = accessor.getSessionId();
        String username = principal.getName();
        logger.info("User leaving room={} user={} session={}", roomId, username, sessionId);

        // FIX: If this is the old (evicted) session finally sending its leave,
        // clean it out of the evictedSessions map and skip the normal removeUserFromRoom
        // (the DB record was already deleted during eviction).
        if (evictedSessions.remove(sessionId) != null) {
            logger.debug("Evicted session={} sent leave — drain complete, ignoring", sessionId);
            return;
        }

        try {
            // FIX: removeUserFromRoom now returns the roomId it cleaned up, or null
            // if the session was already removed (e.g. by the REST session-leave).
            // Only broadcast when we actually performed the removal — avoids sending
            // a duplicate user-list if the REST path already broadcast one.
            String cleanedRoomId = userService.removeUserFromRoom(sessionId);
            if (cleanedRoomId != null) {
                sendUserList(cleanedRoomId);
            }
        } catch (Exception e) {
            logger.error("Error on leave user={} room={}", username, roomId, e);
        }
    }

    @MessageMapping("/board/{roomId}/draw")
    public void handleDraw(
            @DestinationVariable String roomId,
            @Valid BoardActionMessage message,
            Principal principal,
            StompHeaderAccessor accessor) {

        validatePrincipal(principal);
        validateRoomId(roomId);
        requireSessionInRoom(roomId, accessor.getSessionId(), principal.getName());

        boardRedisService.saveAction(roomId, message);
        messagingTemplate.convertAndSend("/topic/room/" + roomId, (Object) message);
    }

    @MessageMapping("/board/{roomId}/text")
    public void handleText(
            @DestinationVariable String roomId,
            @Valid BoardActionMessage message,
            Principal principal,
            StompHeaderAccessor accessor) {

        validatePrincipal(principal);
        validateRoomId(roomId);
        requireSessionInRoom(roomId, accessor.getSessionId(), principal.getName());

        boardRedisService.saveAction(roomId, message);
        messagingTemplate.convertAndSend("/topic/room/" + roomId, (Object) message);
    }

    @MessageMapping("/board/{roomId}/erase")
    public void handleErase(
            @DestinationVariable String roomId,
            @Valid BoardActionMessage message,
            Principal principal,
            StompHeaderAccessor accessor) {

        validatePrincipal(principal);
        validateRoomId(roomId);
        requireSessionInRoom(roomId, accessor.getSessionId(), principal.getName());

        boardRedisService.saveAction(roomId, message);
        messagingTemplate.convertAndSend("/topic/room/" + roomId, (Object) message);
    }

    @MessageMapping("/room/{roomId}/voice/signal")
    public void handleVoiceSignal(
            @DestinationVariable String roomId,
            @Valid VoiceSignalRequest request,
            Principal principal,
            StompHeaderAccessor accessor) {

        validatePrincipal(principal);
        validateRoomId(roomId);
        requireSessionInRoom(roomId, accessor.getSessionId(), principal.getName());

        try {
            voiceSignalingService.relaySignal(roomId, accessor.getSessionId(), principal.getName(), request);
        } catch (IllegalArgumentException e) {
            logger.warn("Voice signal rejected: {}", e.getMessage());
            messagingTemplate.convertAndSendToUser(principal.getName(), "/queue/errors",
                    (Object) Map.of("type", "error", "message", e.getMessage(), "roomId", roomId));
        }
    }

    @MessageMapping("/room/{roomId}/chat")
    public void handleChat(
            @DestinationVariable String roomId,
            @Valid ChatMessageRequest request,
            Principal principal,
            StompHeaderAccessor accessor) {

        validatePrincipal(principal);
        validateRoomId(roomId);
        requireSessionInRoom(roomId, accessor.getSessionId(), principal.getName());

        ChatMessageResponse response = chatService.sendMessage(roomId, principal.getName(), request.getContent());
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/chat", (Object) response);
    }

    @MessageMapping("/room/{roomId}/voice/mic")
    public void handleVoiceMic(
            @DestinationVariable String roomId,
            @Valid VoiceMicRequest request,
            Principal principal,
            StompHeaderAccessor accessor) {

        validatePrincipal(principal);
        validateRoomId(roomId);
        requireSessionInRoom(roomId, accessor.getSessionId(), principal.getName());

        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/users",
                (Object) Map.of("type", "voice-mic",
                        "sessionId", accessor.getSessionId(),
                        "userName", principal.getName(),
                        "muted", request.getMuted()));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void sendUserList(String roomId) {
        try {
            List<ActiveUser> users = userService.getUsersInRoom(roomId);
            List<Map<String, Object>> userList = users.stream()
                    .map(u -> Map.<String, Object>of(
                            "userName", u.getUserName(),
                            "color", u.getColor(),
                            "sessionId", u.getSessionId()))
                    .collect(Collectors.toList());
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/users",
                    (Object) Map.of("type", "user-list", "users", userList));
        } catch (Exception e) {
            logger.error("Error sending user list for room {}", roomId, e);
        }
    }

    private void validatePrincipal(Principal principal) {
        if (principal == null) throw new IllegalStateException("Unauthenticated user");
    }

    private void validateRoomId(String roomId) {
        if (roomId == null || roomId.isBlank() || roomId.length() > 36)
            throw new IllegalArgumentException("Invalid roomId");
    }

    /**
     * FIX: Before throwing, check if this is a known evicted (ghost-drained) session.
     * If so, log at DEBUG instead of WARN and skip sending an error frame —
     * the old WebSocket is dying anyway and sending it errors just causes
     * frontend reconnect loops.
     *
     * Also prune stale TTL entries to prevent unbounded map growth.
     */
    private void requireSessionInRoom(String roomId, String sessionId, String username) {
        if (!userService.isSessionInRoom(roomId, sessionId)) {

            // Prune expired eviction records opportunistically
            long now = System.currentTimeMillis();
            evictedSessions.entrySet().removeIf(e -> now - e.getValue() > EVICTED_SESSION_TTL_MS);

            if (evictedSessions.containsKey(sessionId)) {
                logger.debug("Silently dropping action from evicted session={} user={} room={}",
                        sessionId, username, roomId);
                // Throw so the handler exits, but WebSocketExceptionHandler should
                // NOT send an error frame for evicted sessions. Mark with a subclass:
                throw new EvictedSessionException();
            }

            logger.warn("Session {} (user={}) not in room {} — rejecting action", sessionId, username, roomId);
            throw new IllegalStateException("User not in room");
        }
    }

    /**
     * Marker exception for actions arriving from an already-evicted ghost session.
     * WebSocketExceptionHandler should catch this and do nothing (no error frame sent).
     */
    public static class EvictedSessionException extends RuntimeException {
        public EvictedSessionException() {
            super("Evicted session — silently dropped");
        }
    }
}