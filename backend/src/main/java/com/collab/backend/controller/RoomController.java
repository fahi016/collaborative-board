package com.collab.backend.controller;

import com.collab.backend.dto.*;
import com.collab.backend.exception.BusinessException;
import com.collab.backend.exception.RoomFullException;
import com.collab.backend.exception.RoomNotFoundException;
import com.collab.backend.model.ActiveUser;
import com.collab.backend.model.Room;
import com.collab.backend.model.User;
import com.collab.backend.service.AuthService;
import com.collab.backend.service.RoomService;
import com.collab.backend.service.UserService;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@AllArgsConstructor
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;
    private final UserService userService;
    private final AuthService authService;

    /**
     * Create a new room
     * POST /api/rooms
     */
    @PostMapping
    public ResponseEntity<RoomCreateResponse> createRoom() {
        RoomCreateResponse response = roomService.createRoom();
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
                room.getCurrentUsers(),
                room.getMaxUsers(),
                room.getCreatedAt(),
                room.isFull()
        );

        return ResponseEntity.ok(response);
    }

//    /**
//     * Join a room
//     * POST /api/rooms/{roomId}/join
//     */
//    @PostMapping("/{roomId}/join")
//    public ResponseEntity<JoinRoomResponse> joinRoom(
//            @PathVariable String roomId,
//            @RequestBody JoinRoomRequest request,
//            @RequestHeader(value = "Session-Id", required = false) String sessionId
//    ) {
//        try {
//            // Get authenticated user
//            User currentUser = authService.getCurrentUser();
//
//            // Generate session ID if not provided
//            if (sessionId == null || sessionId.isEmpty()) {
//                sessionId = java.util.UUID.randomUUID().toString();
//            }
//
//            // Check if room is full
//            if (roomService.isRoomFull(roomId)) {
//                throw new RoomFullException("Room is full");
//
//            }
//
//            // Add user to room (updated to use User object)
//            JoinRoomResponse response = userService.joinRoom(
//                    roomId,
//                    currentUser.getName(),
//                    sessionId
//            );
//            return ResponseEntity.ok(response);
//
//        } catch (RoomNotFoundException e) {
//            throw new RoomNotFoundException("Room not found");
//        } catch (RoomFullException e) {
//            throw new RoomFullException("Room is full");
//        } catch (Exception e) {
//            throw new BusinessException(e.getMessage());
//        }
//    }

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
}
