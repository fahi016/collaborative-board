package com.collab.backend.controller;

import com.collab.backend.dto.*;
import com.collab.backend.model.BoardState;
import com.collab.backend.service.BoardService;
import com.collab.backend.service.UserService;
import com.collab.backend.service.AuthService;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import jakarta.validation.Valid;

import java.time.LocalDateTime;

@RestController
@AllArgsConstructor
@RequestMapping("/api/rooms/{roomId}/state")
public class BoardController {

    private final BoardService boardService;
    private final UserService userService;
    private final AuthService authService;

    /**
     * Get board state for a room
     * GET /api/rooms/{roomId}/state?pageNumber=1
     */
    @GetMapping
    public ResponseEntity<BoardStateResponse> getBoardState(
            @PathVariable String roomId,
            @RequestParam(defaultValue = "1") Integer pageNumber
    ) {
        ensureCurrentUserInRoom(roomId);

        BoardState boardState = boardService.getBoardState(roomId, pageNumber);

        BoardStateResponse response = new BoardStateResponse(
                boardState.getCanvasData(),
                boardState.getPageNumber(),
                boardState.getUpdatedAt()
        );

        return ResponseEntity.ok(response);
    }

    /**
     * Update board state.
     * PUT /api/rooms/{roomId}/state
     * Rejected with 409 when the room has active users to avoid conflicting with
     * Redis-backed real-time state (single source of truth during session).
     */
    @PutMapping
    public ResponseEntity<?> updateBoardState(
            @PathVariable String roomId,
            @Valid @RequestBody UpdateBoardStateRequest request
    ) {
        ensureCurrentUserInRoom(roomId);

        if (!userService.getUsersInRoom(roomId).isEmpty()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new ErrorResponse(
                            "BOARD_LOCKED",
                            "Board cannot be updated via REST while users are in the room. Changes are saved automatically when the room is empty.",
                            LocalDateTime.now()
                    ));
        }

        boardService.updateBoardState(
                roomId,
                request.getPageNumber(),
                request.getCanvasData()
        );

        return ResponseEntity.ok(new SuccessResponse(true));
    }

    /**
     * Clear board state
     * DELETE /api/rooms/{roomId}/state?pageNumber=1
     */
    @DeleteMapping
    public ResponseEntity<SuccessResponse> clearBoardState(
            @PathVariable String roomId,
            @RequestParam(defaultValue = "1") Integer pageNumber
    ) {
        ensureCurrentUserInRoom(roomId);

        boardService.clearBoardState(roomId, pageNumber);
        return ResponseEntity.ok(new SuccessResponse(true));
    }

    /**
     * Ensure the authenticated user is an active member of the given room.
     * This prevents authenticated users from accessing or mutating boards for rooms
     * they have not joined.
     */
    private void ensureCurrentUserInRoom(String roomId) {
        var currentUser = authService.getCurrentUser();
        String username = currentUser.getEmail();

        boolean inRoom = userService.isUserInRoom(roomId, username);
        if (!inRoom) {
            throw new AccessDeniedException("User is not a member of room " + roomId);
        }
    }
}
