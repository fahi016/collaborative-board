package com.collab.backend.service;

import com.collab.backend.model.BoardState;
import com.collab.backend.model.Room;
import com.collab.backend.repository.BoardStateRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Transactional
@AllArgsConstructor
public class BoardService {

    /** Default page number for single-page boards. Multi-page would extend flush/snapshot to iterate pages. */
    public static final int DEFAULT_PAGE = 1;

    private BoardStateRepository boardStateRepository;

    private RoomService roomService;

    private final ObjectMapper objectMapper;

    /**
     * Initialize board state for a room and page.
     */
    public BoardState initializeBoardState(String roomId, Integer pageNumber) {
        Room room = roomService.getRoomById(roomId);

        Optional<BoardState> existingState = boardStateRepository.findByRoomAndPageNumber(room, pageNumber);
        if (existingState.isPresent()) {
            return existingState.get();
        }

        BoardState boardState = new BoardState(room, "[]");
        boardState.setPageNumber(pageNumber);
        return boardStateRepository.save(boardState);
    }

    /**
     * Initialize board state for default page (convenience).
     */
    public BoardState initializeBoardState(String roomId) {
        return initializeBoardState(roomId, DEFAULT_PAGE);
    }

    /**
     * Get board state for a room
     */
    public BoardState getBoardState(String roomId, Integer pageNumber) {
        return boardStateRepository.findByRoom_RoomIdAndPageNumber(roomId, pageNumber)
                .orElseGet(() -> initializeBoardState(roomId, pageNumber));
    }

    /**
     * Update board state. Used by: (1) REST PUT when room has no active users,
     * (2) flush from Redis (last user leaves) and scheduled snapshot — to avoid
     * conflicting writers, REST PUT must be rejected when the room has active users.
     */
    public void updateBoardState(String roomId, Integer pageNumber, String canvasData) {
        Optional<BoardState> boardStateOpt = boardStateRepository.findByRoom_RoomIdAndPageNumber(roomId, pageNumber);

        if (boardStateOpt.isPresent()) {
            BoardState boardState = boardStateOpt.get();
            boardState.setCanvasData(canvasData);
            boardStateRepository.save(boardState);
        } else {
            Room room = roomService.getRoomById(roomId);
            BoardState newBoardState = new BoardState(room, canvasData);
            newBoardState.setPageNumber(pageNumber);
            boardStateRepository.save(newBoardState);
        }
    }

    /**
     * Append action to board state (for incremental updates)
     */
    public void appendActionToBoardState(String roomId, Integer pageNumber, Map<String, Object> action) {
        try {
            BoardState boardState = getBoardState(roomId, pageNumber);

            // Parse existing canvas data
            List<Map<String, Object>> actions;
            String existingData = boardState.getCanvasData();

            if (existingData == null || existingData.trim().isEmpty() || existingData.equals("[]")) {
                actions = new ArrayList<>();
            } else {
                actions = objectMapper.readValue(existingData, List.class);
            }

            // Add new action
            actions.add(action);

            // Convert back to JSON
            String updatedData = objectMapper.writeValueAsString(actions);

            // Update board state
            boardState.setCanvasData(updatedData);
            boardStateRepository.save(boardState);

        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to update board state", e);
        }
    }

    /**
     * Clear board state
     */
    public void clearBoardState(String roomId, Integer pageNumber) {
        updateBoardState(roomId, pageNumber, "[]");
    }
}