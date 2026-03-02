package com.collab.backend.service;

import com.collab.backend.model.Room;
import com.collab.backend.model.RoomParticipant;
import com.collab.backend.model.User;
import com.collab.backend.repository.RoomParticipantRepository;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class RoomParticipantService {
    private final RoomParticipantRepository roomParticipantRepository;

    public void addOrUpdateParticipant(Room room, User user) {
        RoomParticipant participant = roomParticipantRepository
                .findByUserAndRoom(user, room)
                .orElseGet(() -> new RoomParticipant(room, user));

        participant.touchLastJoined();
        roomParticipantRepository.save(participant);
    }

    public List<RoomParticipant> getParticipantsForUser(User user) {
        return roomParticipantRepository.findByUser(user);
    }

    public boolean isParticipant(Room room, User user) {
        return roomParticipantRepository.findByUserAndRoom(user, room).isPresent();
    }

    public void removeParticipant(Room room, User user) {
        roomParticipantRepository.findByUserAndRoom(user, room)
                .ifPresent(roomParticipantRepository::delete);
    }

    public void deleteAllParticipants(Room room) {
        List<RoomParticipant> participants = roomParticipantRepository.findByRoom(room);
        roomParticipantRepository.deleteAll(participants);
    }

}
