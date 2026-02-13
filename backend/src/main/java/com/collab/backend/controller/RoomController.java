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
import com.collab.backend.service.RoomService;
import com.collab.backend.service.UserService;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
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
    private final SimpMessagingTemplate messagingTemplate;



    /**
     * Create a new room
     * POST /api/rooms
     */
    @PostMapping
    public ResponseEntity<RoomCreateResponse> createRoom(@Valid @RequestBody RoomCreateRequest request) {
        RoomCreateResponse response = roomService.createRoom(
                authService.getCurrentUser(),
                request.getName()
        );
        
        // Broadcast room creation to all users (for "My Rooms" updates)
        broadcastRoomUpdate(response.getRoomId(), "created", response.getName());
        
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Get room information
     * GET /api/rooms/{roomId}
     */
    @GetMapping("/{roomId}")
    public ResponseEntity<RoomInfoResponse> getRoomInfo(@PathVariable String roomId) {
        Room room = roomService.getRoomById(roomId);

        RoomInfoResponse response = new RoomInfoResponse(
                room.getRoomId(),
                room.getName(),
                room.getCurrentUsers(),
                room.getMaxUsers(),
                room.getCreatedAt(),
                room.isFull()
        );

        return ResponseEntity.ok(response);
    }


    /**
     * Get active users in a room
     * GET /api/rooms/{roomId}/users
     */
    @GetMapping("/{roomId}/users")
    public ResponseEntity<List<ActiveUserResponse>> getActiveUsers(
            @PathVariable String roomId
    ) {
        try {
            List<ActiveUser> users = userService.getUsersInRoom(roomId);

            List<ActiveUserResponse> response = users.stream()
                    .map(user -> new ActiveUserResponse(
                            user.getUserName(),
                            user.getColor(),
                            user.getJoinedAt()
                    ))
                    .toList();

            return ResponseEntity.ok(response);
        } catch (RoomNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // endpoint
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
            @Valid @RequestBody RoomUpdateRequest request
    ) {
        var currentUser = authService.getCurrentUser();
        Room updatedRoom = roomService.updateRoom(roomId, currentUser, request.getName());
        
        RoomInfoResponse response = new RoomInfoResponse(
                updatedRoom.getRoomId(),
                updatedRoom.getName(),
                updatedRoom.getCurrentUsers(),
                updatedRoom.getMaxUsers(),
                updatedRoom.getCreatedAt(),
                updatedRoom.isFull()
        );
        
        // Broadcast room name update to all users in the room
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
        roomService.deleteRoom(roomId, currentUser);
        
        // Broadcast room deletion to all users in the room
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
        
        // Broadcast user left event (optional, for UI updates)
        broadcastRoomUpdate(roomId, "user_left", null);
        
        return ResponseEntity.ok().build();
    }

    /**
     * Broadcast room updates to WebSocket clients
     */
    private void broadcastRoomUpdate(String roomId, String eventType, String roomName) {
        try {
            Map<String, Object> message = Map.of(
                    "type", "room_update",
                    "event", eventType,
                    "roomId", roomId,
                    "roomName", roomName != null ? roomName : ""
            );
            
            // Broadcast to room-specific topic
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/updates", (Object) message);
            
            // Also broadcast to a general room list topic for "My Rooms" updates
            messagingTemplate.convertAndSend("/topic/rooms/list", (Object) message);
            
            logger.debug("Broadcasted room {} event: {}", roomId, eventType);
        } catch (Exception e) {
            logger.error("Error broadcasting room update", e);
        }
    }
}
