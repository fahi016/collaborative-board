package com.collab.backend.repository;

import com.collab.backend.model.BoardState;
import com.collab.backend.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BoardStateRepository extends JpaRepository<BoardState,Long> {
    Optional<BoardState> findByRoomAndPageNumber(Room room, Integer pageNumber);
    Optional<BoardState> findByRoom_RoomIdAndPageNumber(String roomId, Integer pageNumber);

    /**
     * Delete all board states for a room
     */
    void deleteByRoom_RoomId(String roomId);
}
