package com.collab.backend.controller;

import com.collab.backend.model.ActiveUser;
import com.collab.backend.model.User;
import com.collab.backend.repository.ActiveUserRepository;
import com.collab.backend.repository.UserRepository;
import com.collab.backend.service.UserService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * REST endpoint used by the frontend's synchronousLeave() call (fetch with keepalive:true).
 *
 * Why needed: WebSocket DISCONNECT frames are NOT guaranteed to be sent on tab-close
 * or page-reload — the browser can terminate the process before async STOMP DISCONNECT
 * completes. This endpoint is the reliable fallback.
 *
 * FIX: Now also broadcasts the updated user-list to the room after cleanup so that
 * other clients' panels update immediately. Previously the REST path deleted the DB
 * record silently with no broadcast, leaving other users' panels stale.
 */
@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class SessionLeaveController {

    private static final Logger logger = LoggerFactory.getLogger(SessionLeaveController.class);

    private final UserService userService;
    private final UserRepository userRepository;
    private final ActiveUserRepository activeUserRepository;
    // FIX: Added — needed to push updated user-list to the room after cleanup
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping("/{roomId}/session-leave")
    public ResponseEntity<Void> sessionLeave(
            @PathVariable String roomId,
            @AuthenticationPrincipal UserDetails userDetails) {

        if (userDetails == null) return ResponseEntity.noContent().build();

        String email = userDetails.getUsername();
        try {
            Optional<User> user = userRepository.findByEmail(email);
            if (user.isPresent()) {
                activeUserRepository
                        .findByRoom_RoomIdAndUserName(roomId, user.get().getEmail())
                        .ifPresent(activeUser -> {
                            logger.info("session-leave: evicting user={} room={} session={}",
                                    activeUser.getUserName(), roomId, activeUser.getSessionId());
                            // FIX: removeUserFromRoom now returns the roomId if it actually
                            // performed the delete (non-null), or null if already cleaned up.
                            // We only broadcast when we did the work — prevents duplicate
                            // user-list pushes if the WS disconnect fires concurrently.
                            String cleanedRoomId = userService.removeUserFromRoom(activeUser.getSessionId());
                            if (cleanedRoomId != null) {
                                sendUserList(cleanedRoomId);
                            }
                        });
            }
        } catch (Exception e) {
            // Never fail a keepalive request — client won't retry
            logger.error("Error in session-leave for room={} user={}", roomId, email, e);
        }

        return ResponseEntity.noContent().build();
    }

    private void sendUserList(String roomId) {
        try {
            List<ActiveUser> users = userService.getUsersInRoom(roomId);
            List<Map<String, Object>> userList = users.stream()
                    .map(u -> Map.<String, Object>of(
                            "userName", u.getUserName(),
                            "color", u.getColor(),
                            "sessionId", u.getSessionId()))
                    .collect(Collectors.toList());
            messagingTemplate.convertAndSend(
                    "/topic/room/" + roomId + "/users",
                    (Object) Map.of("type", "user-list", "users", userList));
        } catch (Exception e) {
            logger.error("Error sending user list after session-leave for room {}", roomId, e);
        }
    }
}
