package com.collab.board.controller;

import com.collab.backend.dto.*;
import com.collab.backend.model.BoardState;
import com.collab.backend.service.BoardService;
import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@AllArgsConstructor
@RequestMapping("/api/rooms/{roomId}/state")
public class BoardController {

    private final BoardService boardService;

    /**
     * Get board state for a room
     * GET /api/rooms/{roomId}/state?pageNumber=1
     */
    @GetMapping
    public ResponseEntity<BoardStateResponse> getBoardState(
            @PathVariable String roomId,
            @RequestParam(defaultValue = "1") Integer pageNumber
    ) {
        BoardState boardState = boardService.getBoardState(roomId, pageNumber);

        BoardStateResponse response = new BoardStateResponse(
                boardState.getCanvasData(),
                boardState.getPageNumber(),
                boardState.getUpdatedAt()
        );

        return ResponseEntity.ok(response);
    }

    /**
     * Update board state
     * PUT /api/rooms/{roomId}/state
     */
    @PutMapping
    public ResponseEntity<SuccessResponse> updateBoardState(
            @PathVariable String roomId,
            @RequestBody UpdateBoardStateRequest request
    ) {
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
        boardService.clearBoardState(roomId, pageNumber);
        return ResponseEntity.ok(new SuccessResponse(true));
    }
}
