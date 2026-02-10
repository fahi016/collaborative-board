package com.collab.backend.repository;

import com.collab.backend.model.BoardState;
import com.collab.backend.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BoardStateRepository extends JpaRepository<BoardState,Long> {
    Optional<BoardState> findByRoomAndPageNumber(Room room, Integer pageNumber);
    Optional<BoardState> findByRoom_RoomIdAndPageNumber(String roomId, Integer pageNumber);


}
