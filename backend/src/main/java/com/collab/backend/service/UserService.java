package com.collab.backend.service;

import com.collab.backend.dto.JoinRoomResponse;
import com.collab.backend.exception.RoomFullException;
import com.collab.backend.model.ActiveUser;
import com.collab.backend.model.Room;
import com.collab.backend.model.User;
import com.collab.backend.repository.ActiveUserRepository;
import com.collab.backend.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;

@Service
@Transactional
@AllArgsConstructor
public class UserService {

    private static final Logger logger = LoggerFactory.getLogger(UserService.class);

    private final ActiveUserRepository repository;
    private final RoomService roomService;
    private final BoardRedisService boardRedisService;
    private final BoardService boardService;

    private static final String[] COLORS = {
            "#FF5733", "#33FF57", "#3357FF", "#FF33F5", "#F5FF33",
            "#33FFF5", "#FF8C33", "#8C33FF", "#33FF8C", "#FF3333"
    };

    //Join room

    public JoinRoomResponse joinAuthenticatedUser(String roomId, String userName, String sessionId) {

        if (sessionId == null || sessionId.isBlank()) {
            sessionId = UUID.randomUUID().toString();
        }

        Room room = roomService.getRoomByIdForUpdate(roomId);

        // 🔥 FIRST check if user already active anywhere
        Optional<ActiveUser> existingUserGlobal =
                repository.findByUserName(userName);

        if (existingUserGlobal.isPresent()) {

            ActiveUser existing = existingUserGlobal.get();

            if (existing.getRoom().getRoomId().equals(roomId)) {
                throw new IllegalStateException(
                        "User already active in this room from another tab"
                );
            }

            throw new IllegalStateException(
                    "User already active in another room: "
                            + existing.getRoom().getRoomId()
            );
        }

        // THEN check room capacity
        if (room.isFull()) {
            throw new RoomFullException("Room is full");
        }

        room.incrementUserCount();
        roomService.save(room);

        String color = generateUserColor();
        ActiveUser user = new ActiveUser(room, userName, sessionId, color);
        repository.save(user);

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
            String roomId = room.getRoomId();

            repository.delete(user);
            roomService.decrementUserCount(room.getRoomId());

            Room updatedRoom = roomService.getRoomById(roomId);

            if (updatedRoom.getCurrentUsers() == 0) {

                List<Object> actions =
                        boardRedisService.getAllActions(roomId);

                if (actions != null && !actions.isEmpty()) {
                    try {
                        String json = new com.fasterxml.jackson.databind.ObjectMapper()
                                .writeValueAsString(actions);

                        boardService.updateBoardState(roomId, 1, json);

                    } catch (Exception e) {
                        logger.error("Failed to persist board actions for room {}", roomId, e);
                    }
                }

                boardRedisService.clearRoom(roomId);
            }

        }
    }


    public void removeUserBySimpSessionId(String simpSessionId) {
        Optional<ActiveUser> userOpt =
                repository.findBySessionId(simpSessionId);

        if (userOpt.isPresent()) {
            ActiveUser user = userOpt.get();
            String roomId = user.getRoom().getRoomId();

            repository.delete(user);
            roomService.decrementUserCount(roomId);
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

    public boolean isUserInRoom(String roomId, String username) {

        return repository.existsByRoom_RoomIdAndUserName(roomId, username);
    }

    public boolean isSessionInRoom(String roomId, String sessionId) {
        return repository.existsByRoom_RoomIdAndSessionId(roomId, sessionId);
    }


}
