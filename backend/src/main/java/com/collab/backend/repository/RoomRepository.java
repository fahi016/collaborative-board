package com.collab.backend.repository;

import com.collab.backend.model.Room;
import com.collab.backend.model.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room,String> {

    Optional<Room> findByRoomId(String roomId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM Room r WHERE r.roomId = :roomId")
    Optional<Room> findByRoomIdForUpdate(@Param("roomId") String roomId);

    List<Room> findByOwnerOrderByCreatedAtDesc(User owner);


    boolean existsByRoomId(String roomId);

    @Query("SELECT r FROM Room r JOIN FETCH r.owner WHERE r.roomId = :roomId")
    Optional<Room> findByRoomIdWithOwner(@Param("roomId") String roomId);
}
