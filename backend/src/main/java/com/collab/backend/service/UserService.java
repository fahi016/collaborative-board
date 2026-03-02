package com.collab.backend.service;

import com.collab.backend.dto.JoinRoomResponse;
import com.collab.backend.exception.RoomFullException;
import com.collab.backend.exception.RoomNotFoundException;
import com.collab.backend.model.ActiveUser;
import com.collab.backend.model.Room;
import com.collab.backend.repository.ActiveUserRepository;
import com.collab.backend.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class UserService {

    private static final Logger logger = LoggerFactory.getLogger(UserService.class);

    @Value("${app.allow-multi-room-per-user:false}")
    private boolean allowMultiRoomPerUser;

    private final ActiveUserRepository repository;
    private final RoomService roomService;
    private final BoardRedisService boardRedisService;
    private final BoardService boardService;

    private static final String[] COLORS = {
            "#FF5733", "#33FF57", "#3357FF", "#FF33F5", "#F5FF33",
            "#33FFF5", "#FF8C33", "#8C33FF", "#33FF8C", "#FF3333"
    };

    /**
     * Original join method — kept for callers that don't need eviction info.
     */
    public JoinRoomResponse joinAuthenticatedUser(String roomId, String userName, String sessionId) {
        joinAuthenticatedUserAndGetEvictedSession(roomId, userName, sessionId);
        return getActiveJoinResponse(roomId, userName, sessionId);
    }

    /**
     * FIX: New join variant that returns the evicted ghost sessionId (or null if none).
     * WebSocketController uses this to register the old session for silent drain,
     * suppressing the "User not in room" warn spam that occurred when the ghost's
     * in-flight messages arrived after its DB record was deleted.
     *
     * @return evicted session ID, or null if no ghost was present
     */
    public String joinAuthenticatedUserAndGetEvictedSession(String roomId, String userName, String sessionId) {

        if (sessionId == null || sessionId.isBlank()) {
            sessionId = UUID.randomUUID().toString();
        }

        roomService.syncCurrentUserCount(roomId);
        Room room = roomService.getRoomByIdForUpdate(roomId);

        // ── Idempotent re-join ─────────────────────────────────────────────────
        if (repository.existsByRoom_RoomIdAndSessionId(roomId, sessionId)) {
            ActiveUser existing = repository.findByRoomAndSessionId(room, sessionId)
                    .orElseThrow();
            existing.refreshHeartbeat();
            repository.save(existing);
            logger.info("Idempotent re-join user={} session={} room={}", userName, sessionId, roomId);
            return null; // no eviction
        }

        // ── Ghost session in THIS room ─────────────────────────────────────────
        String evictedSessionId = null;
        Optional<ActiveUser> ghostInRoom = repository.findByRoom_RoomIdAndUserName(roomId, userName);
        if (ghostInRoom.isPresent()) {
            evictedSessionId = ghostInRoom.get().getSessionId();
            logger.warn("Evicting ghost session for user={} room={} oldSession={} newSession={}",
                    userName, roomId, evictedSessionId, sessionId);
            repository.deleteByRoomIdAndUserName(roomId, userName);
            // Don't touch currentUsers — we deleted one and will insert one below
        } else {
            // ── User already in a different room ──────────────────────────────
            if (!allowMultiRoomPerUser) {
                Optional<ActiveUser> inOtherRoom = repository.findByUserName(userName);
                if (inOtherRoom.isPresent()) {
                    String otherRoomId = inOtherRoom.get().getRoom().getRoomId();
                    logger.warn("User={} already in room={}, rejecting join to room={}",
                            userName, otherRoomId, roomId);
                    throw new IllegalStateException(
                            "You are already active in another room. Please leave it first.");
                }
            }

            if (room.isFull()) {
                throw new RoomFullException("Room is full");
            }
        }

        // ── Create new ActiveUser record ───────────────────────────────────────
        String color = generateUserColor();
        ActiveUser user = new ActiveUser(room, userName, sessionId, color);
        repository.save(user);

        if (evictedSessionId == null) {
            // Truly new slot — increment
            room.incrementUserCount();
            roomService.save(room);
        }

        return evictedSessionId; // null if no ghost eviction occurred
    }

    /**
     * Build a JoinRoomResponse from the now-current ActiveUser record.
     * Called after joinAuthenticatedUserAndGetEvictedSession completes.
     */
    public JoinRoomResponse getActiveJoinResponse(String roomId, String userName, String sessionId) {
        Room room = roomService.getRoomById(roomId);
        ActiveUser activeUser = repository.findByRoomAndSessionId(room, sessionId)
                .orElseThrow(() -> new IllegalStateException(
                        "ActiveUser record missing after join for session=" + sessionId));
        return new JoinRoomResponse(true, activeUser.getUserName(), activeUser.getColor(), activeUser.getSessionId());
    }

    /**
     * Remove user by sessionId. Idempotent — safe to call from both explicit leave
     * and SessionDisconnectEvent without double-decrement.
     *
     * @return the roomId the user was removed from, or null if the session was
     *         not found (already cleaned up). Callers that need to broadcast a
     *         user-list update should only do so when this returns non-null.
     */
    public String removeUserFromRoom(String sessionId) {
        Optional<ActiveUser> userOpt = repository.findBySessionId(sessionId);

        if (userOpt.isEmpty()) {
            logger.debug("Session {} already removed or never existed", sessionId);
            return null; // already gone — nothing to broadcast
        }

        String roomId = userOpt.get().getRoom().getRoomId();

        int deleted = repository.deleteBySessionId(sessionId);
        if (deleted == 0) {
            logger.debug("Session {} removed by concurrent thread", sessionId);
            return null; // concurrent cleanup beat us — nothing to broadcast
        }

        roomService.decrementUserCount(roomId);

        Room updatedRoom = roomService.getRoomById(roomId);
        if (updatedRoom.getCurrentUsers() == 0) {
            persistBoardAndClearRedis(roomId);
        }

        return roomId; // signal to caller: broadcast needed for this room
    }

    private void persistBoardAndClearRedis(String roomId) {
        List<Object> actions = boardRedisService.getAllActions(roomId);
        if (actions != null && !actions.isEmpty()) {
            try {
                String json = new com.fasterxml.jackson.databind.ObjectMapper()
                        .writeValueAsString(actions);
                boardService.updateBoardState(roomId, BoardService.DEFAULT_PAGE, json);
            } catch (Exception e) {
                logger.error("Failed to persist board actions for room {}", roomId, e);
            }
        }
        boardRedisService.clearRoom(roomId);
    }

    public List<ActiveUser> getUsersInRoom(String roomId) {
        return repository.findByRoom_RoomId(roomId);
    }

    public boolean isUserInRoom(String roomId, String username) {
        return repository.existsByRoom_RoomIdAndUserName(roomId, username);
    }

    public boolean isSessionInRoom(String roomId, String sessionId) {
        return repository.existsByRoom_RoomIdAndSessionId(roomId, sessionId);
    }

    public Optional<String> getUsernameBySessionIdInRoom(String roomId, String sessionId) {
        if (roomId == null || sessionId == null) return Optional.empty();
        Room room;
        try {
            room = roomService.getRoomById(roomId);
        } catch (RoomNotFoundException e) {
            return Optional.empty();
        }
        return repository.findByRoomAndSessionId(room, sessionId)
                .map(ActiveUser::getUserName);
    }

    private String generateUserColor() {
        return COLORS[new Random().nextInt(COLORS.length)];
    }
}