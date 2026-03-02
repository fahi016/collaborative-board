package com.collab.backend.repository;

import com.collab.backend.model.ActiveUser;
import com.collab.backend.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ActiveUserRepository extends JpaRepository<ActiveUser, Long> {

    List<ActiveUser> findByRoom(Room room);
    List<ActiveUser> findByRoom_RoomId(String roomId);

    Optional<ActiveUser> findBySessionId(String sessionId);
    Optional<ActiveUser> findByRoomAndSessionId(Room room, String sessionId);

    // FIX: Scoped to room — was findByUserName(userName) which searched globally
    // and found ghost sessions in OTHER rooms, incorrectly blocking re-entry.
    Optional<ActiveUser> findByRoom_RoomIdAndUserName(String roomId, String userName);

    // Kept for cross-room single-session enforcement (allowMultiRoomPerUser check)
    Optional<ActiveUser> findByUserName(String userName);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM ActiveUser a WHERE a.sessionId = :sessionId")
    int deleteBySessionId(@Param("sessionId") String sessionId);

    // FIX: Added — evicts ghost sessions by roomId+userName atomically before re-insert
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM ActiveUser a WHERE a.room.roomId = :roomId AND a.userName = :userName")
    int deleteByRoomIdAndUserName(@Param("roomId") String roomId, @Param("userName") String userName);

    long countByRoom(Room room);

    boolean existsByRoom_RoomIdAndUserName(String roomId, String username);
    boolean existsByRoom_RoomIdAndSessionId(String roomId, String sessionId);

    void deleteByRoom_RoomId(String roomId);

    // FIX: Added for stale-session scheduler
    @Query("SELECT a FROM ActiveUser a WHERE a.lastHeartbeat < :cutoff")
    List<ActiveUser> findStaleSessionsOlderThan(@Param("cutoff") LocalDateTime cutoff);
}