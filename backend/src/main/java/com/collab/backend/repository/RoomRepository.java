package com.collab.backend.repository;

import com.collab.backend.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room,String> {

    Optional<Room> findByRoomId(String roomId);

    boolean existsByRoomId(String roomId);
}
