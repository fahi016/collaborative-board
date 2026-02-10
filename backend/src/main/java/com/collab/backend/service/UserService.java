package com.collab.backend.service;

import com.collab.backend.dto.JoinRoomResponse;
import com.collab.backend.exception.RoomFullException;
import com.collab.backend.model.ActiveUser;
import com.collab.backend.model.Room;
import com.collab.backend.repository.ActiveUserRepository;
import jakarta.transaction.Transactional;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;

@Service
@Transactional
@AllArgsConstructor
public class UserService {

    private final ActiveUserRepository repository;
    private final RoomService roomService;

    private static final String[] COLORS = {
            "#FF5733", "#33FF57", "#3357FF", "#FF33F5", "#F5FF33",
            "#33FFF5", "#FF8C33", "#8C33FF", "#33FF8C", "#FF3333"
    };

    /**
     * Join a room (atomic & safe)
     */
    public JoinRoomResponse joinRoom(String roomId, String userName, String sessionId) {

        // Generate session ID if missing
        if (sessionId == null || sessionId.isBlank()) {
            sessionId = UUID.randomUUID().toString();
        }

        // Fetch room with lock (RoomService must ensure locking)
        Room room = roomService.getRoomByIdForUpdate(roomId);

        // Check if user already exists in room
        Optional<ActiveUser> existingUser =
                repository.findByRoomAndSessionId(room, sessionId);

        if (existingUser.isPresent()) {
            ActiveUser user = existingUser.get();
            return new JoinRoomResponse(
                    true,
                    user.getUserName(),
                    user.getColor(),
                    user.getSessionId()
            );
        }

        // Check room capacity
        if (room.isFull()) {
            throw new RoomFullException("Room is full");
        }

        // Create new user
        String color = generateUserColor();
        ActiveUser user = new ActiveUser(room, userName, sessionId, color);
        repository.save(user);

        // Increment room user count
        room.incrementUsersCount();

        return new JoinRoomResponse(
                true,
                user.getUserName(),
                user.getColor(),
                user.getSessionId()
        );
    }

    /**
     * Remove user from room
     */
    public void removeUserFromRoom(String sessionId) {
        Optional<ActiveUser> userOpt = repository.findBySessionId(sessionId);

        if (userOpt.isPresent()) {
            ActiveUser user = userOpt.get();
            Room room = user.getRoom();

            repository.delete(user);
            room.decrementUsersCount();
        }
    }

    /**
     * Get active users in a room
     */
    public List<ActiveUser> getUsersInRoom(String roomId) {
        return repository.findByRoom_RoomId(roomId);
    }

    private String generateUserColor() {
        Random random = new Random();
        return COLORS[random.nextInt(COLORS.length)];
    }
}
