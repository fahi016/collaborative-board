package com.collab.backend.repository;

import com.collab.backend.model.Room;
import com.collab.backend.model.RoomParticipant;
import com.collab.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomParticipantRepository extends JpaRepository<RoomParticipant, Long> {

    List<RoomParticipant> findByUser(User user);

    Optional<RoomParticipant> findByUserAndRoom(User user, Room room);

    List<RoomParticipant> findByRoom(Room room);
}