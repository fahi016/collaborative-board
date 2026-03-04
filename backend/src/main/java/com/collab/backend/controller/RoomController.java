package com.collab.backend.controller;

import com.collab.backend.dto.ActiveUserResponse;
import com.collab.backend.dto.RoomCreateRequest;
import com.collab.backend.dto.RoomCreateResponse;
import com.collab.backend.dto.RoomInfoResponse;
import com.collab.backend.dto.RoomUpdateRequest;
import com.collab.backend.dto.UserRoomSummary;
import com.collab.backend.exception.RoomNotFoundException;
import com.collab.backend.model.ActiveUser;
import com.collab.backend.model.Room;
import com.collab.backend.service.AuthService;
import com.collab.backend.service.ChatService;
import com.collab.backend.service.RoomService;
import com.collab.backend.service.UserService;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@AllArgsConstructor
@RequestMapping("/api/rooms")
public class RoomController {
    private static final Logger logger = LoggerFactory.getLogger(RoomController.class);

    private final RoomService roomService;
    private final UserService userService;
    private final AuthService authService;
    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Create a new room
     * POST /api/rooms
     */
    @PostMapping
    public ResponseEntity<RoomCreateResponse> createRoom(@Valid @RequestBody RoomCreateRequest request) {
        RoomCreateResponse response = roomService.createRoom(
                authService.getCurrentUser(),
                request.getName());
        broadcastRoomUpdate(response.getRoomId(), "created", response.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Get room information
     * GET /api/rooms/{roomId}
     *
     * FIX: Now fetches room with owner eagerly loaded and includes ownerId +
     * ownerName
     * in the response. Previously the response had no owner info, so the frontend
     * could not determine who created the room — leading to "test16 sees test17 as
     * creator" confusion (both sides derived ownership incorrectly from local
     * state).
     */
    @GetMapping("/{roomId}")
    public ResponseEntity<RoomInfoResponse> getRoomInfo(@PathVariable String roomId) {
        var currentUser = authService.getCurrentUser();
        boolean canAccess = roomService.canAccessRoom(currentUser, roomId);

        Room room = roomService.getRoomByIdWithOwner(roomId);

        RoomInfoResponse response = new RoomInfoResponse(
                room.getRoomId(),
                canAccess ? room.getName() : null,
                room.getCurrentUsers(),
                room.getMaxUsers(),
                room.getCreatedAt(),
                room.isFull(),
                canAccess ? room.getOwner().getId() : null,
                canAccess ? room.getOwner().getEmail() : null);

        return ResponseEntity.ok(response);
    }

    /**
     * Get active users in a room
     * GET /api/rooms/{roomId}/users
     */
    @GetMapping("/{roomId}/users")
    public ResponseEntity<List<ActiveUserResponse>> getActiveUsers(@PathVariable String roomId) {
        var currentUser = authService.getCurrentUser();
        if (!roomService.canAccessRoom(currentUser, roomId)) {
            throw new AccessDeniedException("You do not have access to this room");
        }

        List<ActiveUser> users = userService.getUsersInRoom(roomId);
        List<ActiveUserResponse> response = users.stream()
                .map(user -> new ActiveUserResponse(
                        user.getUserName(),
                        user.getColor(),
                        user.getSessionId(),
                        user.getJoinedAt()))
                .toList();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/my")
    public ResponseEntity<List<UserRoomSummary>> getMyRooms() {
        var currentUser = authService.getCurrentUser();
        List<UserRoomSummary> rooms = roomService.getRoomsForUser(currentUser);
        return ResponseEntity.ok(rooms);
    }

    /**
     * Update room name (only owner can update)
     * PUT /api/rooms/{roomId}
     */
    @PutMapping("/{roomId}")
    public ResponseEntity<RoomInfoResponse> updateRoom(
            @PathVariable String roomId,
            @Valid @RequestBody RoomUpdateRequest request) {
        var currentUser = authService.getCurrentUser();
        Room updatedRoom = roomService.updateRoom(roomId, currentUser, request.getName());

        RoomInfoResponse response = new RoomInfoResponse(
                updatedRoom.getRoomId(),
                updatedRoom.getName(),
                updatedRoom.getCurrentUsers(),
                updatedRoom.getMaxUsers(),
                updatedRoom.getCreatedAt(),
                updatedRoom.isFull(),
                updatedRoom.getOwner().getId(),
                updatedRoom.getOwner().getEmail());

        broadcastRoomUpdate(roomId, "updated", updatedRoom.getName());
        return ResponseEntity.ok(response);
    }

    /**
     * Delete a room (only owner can delete)
     * DELETE /api/rooms/{roomId}
     */
    @DeleteMapping("/{roomId}")
    public ResponseEntity<Void> deleteRoom(@PathVariable String roomId) {
        var currentUser = authService.getCurrentUser();
        // FIX: chatService.deleteByRoom_RoomId was called here before
        // roomService.deleteRoom,
        // as two separate transactions. If roomService.deleteRoom failed, chat messages
        // were
        // already gone with no rollback. Also, calling a @Modifying delete outside of
        // any
        // transaction caused "No EntityManager with actual transaction available"
        // errors.
        // The clean fix: move chat deletion inside RoomService.deleteRoom so the entire
        // teardown (active users, Redis, board states, chat, participants, room) is one
        // atomic transaction. ChatService is now only called from within RoomService.
        roomService.deleteRoom(roomId, currentUser);
        broadcastRoomUpdate(roomId, "deleted", null);
        return ResponseEntity.noContent().build();
    }

    /**
     * Leave a room (remove participant record)
     * POST /api/rooms/{roomId}/leave
     */
    @PostMapping("/{roomId}/leave")
    public ResponseEntity<Void> leaveRoom(@PathVariable String roomId) {
        var currentUser = authService.getCurrentUser();
        roomService.leaveRoom(roomId, currentUser);
        broadcastRoomUpdate(roomId, "user_left", null);
        return ResponseEntity.ok().build();
    }

    private void broadcastRoomUpdate(String roomId, String eventType, String roomName) {
        try {
            Map<String, Object> message = Map.of(
                    "type", "room_update",
                    "event", eventType,
                    "roomId", roomId,
                    "roomName", roomName != null ? roomName : "");
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/updates", (Object) message);
            messagingTemplate.convertAndSend("/topic/rooms/list", (Object) message);
        } catch (Exception e) {
            logger.error("Error broadcasting room update", e);
        }
    }
}
