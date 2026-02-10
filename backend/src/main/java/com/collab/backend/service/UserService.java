package com.collab.backend.service;

import com.collab.backend.model.ActiveUser;
import com.collab.backend.model.Room;
import com.collab.backend.repository.ActiveUserRepository;
import jakarta.transaction.Transactional;
import lombok.AllArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.Random;

@Service
@Transactional
@AllArgsConstructor
public class UserService {
    private ActiveUserRepository repository;
    private RoomService roomService;

    private static final String[] COLORS = {
            "#FF5733", "#33FF57", "#3357FF", "#FF33F5", "#F5FF33",
            "#33FFF5", "#FF8C33", "#8C33FF", "#33FF8C", "#FF3333"
    };

    public ActiveUser addUserToRoom(String roomId, String userName, String sessionId) {
        Room room = roomService.getRoomById(roomId);

        // Check if user already exists in room
        Optional<ActiveUser> existingUser = repository.findByRoomAndSessionId(room, sessionId);
        if (existingUser.isPresent()) {
            return existingUser.get();
        }

        // Generate random color for user
        String color = generateUserColor();

        ActiveUser user = new ActiveUser(room, userName, sessionId, color);
        repository.save(user);

        // Increment room user count
        roomService.incrementUserCount(roomId);

        return user;
    }

    public void removeUserFromRoom(String sessionId) {
        Optional<ActiveUser> userOpt = repository.findBySessionId(sessionId);

        if (userOpt.isPresent()) {
            ActiveUser user = userOpt.get();
            String roomId = user.getRoom().getRoomId();

            repository.delete(user);

            // Decrement room user count
            roomService.decrementUserCount(roomId);
        }
    }


    public List<ActiveUser> getUsersInRoom(String roomId) {
        return repository.findByRoom_RoomId(roomId);
    }


    public Optional<ActiveUser> getUserBySessionId(String sessionId) {
        return repository.findBySessionId(sessionId);
    }

    private String generateUserColor() {
        Random random = new Random();
        return COLORS[random.nextInt(COLORS.length)];
    }


}
