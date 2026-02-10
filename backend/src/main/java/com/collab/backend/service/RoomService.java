package com.collab.backend.service;

import com.collab.backend.dto.RoomCreateResponse;
import com.collab.backend.exception.RoomFullException;
import com.collab.backend.exception.RoomNotFoundException;
import com.collab.backend.model.Room;
import com.collab.backend.repository.RoomRepository;
import jakarta.transaction.Transactional;
import lombok.AllArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@Transactional
@AllArgsConstructor
public class RoomService {
    private RoomRepository repository;

    public RoomCreateResponse createRoom(){
        String roomId = generateRoomId();

        while(repository.existsByRoomId(roomId)){
            roomId = generateRoomId();

        }
        Room room = new Room(roomId);
        repository.save(room);

        return new RoomCreateResponse(
                room.getRoomId(),
                room.getCreatedAt(),
                room.getMaxUsers()
        );
    }

    public Room getRoomById(String roomId) {
        return repository.findByRoomId(roomId)
                .orElseThrow(() -> new RoomNotFoundException("Room not found: " + roomId));
    }

    public boolean roomExists(String roomId) {
        return repository.existsByRoomId(roomId);
    }

    public boolean isRoomFull(String roomId) {
        Room room = getRoomById(roomId);
        return room.isFull();
    }
    public Room getRoomByIdForUpdate(String roomId) {
        return repository.findByRoomIdForUpdate(roomId)
                .orElseThrow(() -> new RoomNotFoundException("Room not found"));
    }


    public void incrementUserCount(String roomId) {
        Room room = getRoomById(roomId);

        if (room.isFull()) {
            throw new RoomFullException("Room is full: " + roomId);
        }

        room.incrementUserCount();
        repository.save(room);
    }

    public void decrementUserCount(String roomId) {
        Room room = getRoomById(roomId);
        room.decrementUserCount();
        repository.save(room);
    }

    private String generateRoomId() {
        return UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }


}
