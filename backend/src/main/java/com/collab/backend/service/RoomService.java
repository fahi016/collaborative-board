package com.collab.backend.service;

import com.collab.backend.dto.RoomCreateResponse;
import com.collab.backend.dto.UserRoomSummary;
import com.collab.backend.exception.RoomFullException;
import com.collab.backend.exception.RoomNotFoundException;
import com.collab.backend.model.Room;
import com.collab.backend.model.RoomParticipant;
import com.collab.backend.model.User;
import com.collab.backend.repository.ActiveUserRepository;
import com.collab.backend.repository.BoardStateRepository;
import com.collab.backend.repository.RoomRepository;
import com.collab.backend.service.BoardRedisService;
import jakarta.transaction.Transactional;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;


import java.time.LocalDateTime;

@Service
@Transactional
@AllArgsConstructor
public class RoomService {
    private RoomRepository repository;
    private final RoomParticipantService roomParticipantService;
    private final ActiveUserRepository activeUserRepository;
    private final BoardStateRepository boardStateRepository;
    private final BoardRedisService boardRedisService;


    public RoomCreateResponse createRoom(User owner, String name) {
        String roomId = generateRoomId();

        while(repository.existsByRoomId(roomId)){
            roomId = generateRoomId();
        }

        Room room = new Room(roomId, owner, name);
        repository.save(room);

        return new RoomCreateResponse(
                room.getRoomId(),
                room.getName(),
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

    private static final int ROOM_ID_MAX_RETRIES = 5;

    /**
     * Generate a short, user-friendly room ID with low collision probability.
     * Tries up to ROOM_ID_MAX_RETRIES times; on repeated collision falls back to a longer UUID-based id.
     */
    private String generateRoomId() {
        for (int i = 0; i < ROOM_ID_MAX_RETRIES; i++) {
            String raw = UUID.randomUUID().toString().replace("-", "").toUpperCase();
            String candidate = raw.substring(0, 10);
            if (!repository.existsByRoomId(candidate)) {
                return candidate;
            }
        }
        return UUID.randomUUID().toString().replace("-", "").toUpperCase();
    }


    public void save(Room room) {
        repository.save(room);
    }




        public List<UserRoomSummary> getRoomsForUser(User user) {
            Map<String, UserRoomSummary> result = new LinkedHashMap<>();

            // 1) Rooms the user owns (if you've added owner to Room)
            List<Room> ownedRooms = repository.findByOwnerOrderByCreatedAtDesc(user);
            for (Room room : ownedRooms) {
                result.put(room.getRoomId(), new UserRoomSummary(
                        room.getRoomId(),
                        room.getName(),
                        room.getCurrentUsers(),
                        room.getMaxUsers(),
                        room.getCreatedAt(),
                        room.isFull(),
                        true,
                        null // lastJoinedAt not needed for owner or can be createdAt
                ));
            }

            // 2) Rooms the user has joined
            List<RoomParticipant> memberships = roomParticipantService.getParticipantsForUser(user);
            for (RoomParticipant membership : memberships) {
                Room room = membership.getRoom();
                // If already in map as owner, just update lastJoinedAt if present
                result.merge(
                        room.getRoomId(),
                        new UserRoomSummary(
                                room.getRoomId(),
                                room.getName(),
                                room.getCurrentUsers(),
                                room.getMaxUsers(),
                                room.getCreatedAt(),
                                room.isFull(),
                                false,
                                membership.getLastJoinedAt()
                        ),
                        (existing, incoming) -> {
                            // Keep owner=true if any record says owner
                            boolean owner = existing.isOwner() || incoming.isOwner();
                            LocalDateTime lastJoinedAt =
                                    existing.getLastJoinedAt() != null
                                            ? existing.getLastJoinedAt()
                                            : incoming.getLastJoinedAt();
                            return new UserRoomSummary(
                                    existing.getRoomId(),
                                    existing.getName(),
                                    existing.getCurrentUsers(),
                                    existing.getMaxUsers(),
                                    existing.getCreatedAt(),
                                    existing.isFull(),
                                    owner,
                                    lastJoinedAt
                            );
                        }
                );
            }

            // Optional: sort by createdAt or lastJoinedAt
            return result.values().stream()
                    .sorted(Comparator.comparing(
                            (UserRoomSummary r) -> Optional.ofNullable(r.getLastJoinedAt()).orElse(r.getCreatedAt())
                    ).reversed())
                    .collect(Collectors.toList());
        }

    /**
     * Update room name (only owner can update)
     */
    public Room updateRoom(String roomId, User user, String newName) {
        Room room = getRoomByIdWithOwner(roomId);
        
        // Check if user is the owner
        if (!room.getOwner().getId().equals(user.getId())) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Only the room owner can update the room"
            );
        }
        
        room.setName(newName);
        return repository.save(room);
    }

    /**
     * Delete a room (only owner can delete)
     */
    public void deleteRoom(String roomId, User user) {
        Room room = getRoomByIdWithOwner(roomId);
        
        // Check if user is the owner
        if (!room.getOwner().getId().equals(user.getId())) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Only the room owner can delete the room"
            );
        }
        
        // Delete all active users first (to avoid foreign key constraint violation)
        activeUserRepository.deleteByRoom_RoomId(roomId);
        
        // Clear Redis data for this room
        boardRedisService.clearRoom(roomId);
        
        // Delete all board states for this room
        boardStateRepository.deleteByRoom_RoomId(roomId);
        
        // Delete all participants
        roomParticipantService.deleteAllParticipants(room);
        
        // Delete the room
        repository.delete(room);
    }

    /**
     * Get room by ID with owner eagerly fetched (for ownership checks)
     */
    public Room getRoomByIdWithOwner(String roomId) {
        return repository.findByRoomIdWithOwner(roomId)
                .orElseThrow(() -> new RoomNotFoundException("Room not found: " + roomId));
    }

    /**
     * Leave a room (remove participant record)
     */
    public void leaveRoom(String roomId, User user) {
        Room room = getRoomByIdWithOwner(roomId);
        
        // Check if user is the owner - owners cannot leave, they must delete
        if (room.getOwner().getId().equals(user.getId())) {
            throw new IllegalArgumentException(
                    "Room owners cannot leave their own room. Please delete the room instead."
            );
        }
        
        // Remove participant record
        roomParticipantService.removeParticipant(room, user);
    }

}
