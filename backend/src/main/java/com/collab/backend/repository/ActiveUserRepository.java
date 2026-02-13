package com.collab.backend.repository;

import com.collab.backend.model.ActiveUser;
import com.collab.backend.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ActiveUserRepository extends JpaRepository<ActiveUser, Long> {

    /**
     * Find all active users in a room
     */
    List<ActiveUser> findByRoom(Room room);

    /**
     * Find all active users by room ID
     */
    List<ActiveUser> findByRoom_RoomId(String roomId);

    /**
     * Find user by session ID
     */
    Optional<ActiveUser> findBySessionId(String sessionId);

    /**
     * Find user by room and session ID
     */
    Optional<ActiveUser> findByRoomAndSessionId(Room room, String sessionId);

    /**
     * Delete user by session ID
     */
    void deleteBySessionId(String sessionId);

    /**
     * Count users in a room
     */
    long countByRoom(Room room);
    Optional<ActiveUser> findByUserName(String userName);


    boolean existsByRoom_RoomIdAndUserName(String roomId, String username);

    boolean existsByRoom_RoomIdAndSessionId(String roomId, String sessionId);
}