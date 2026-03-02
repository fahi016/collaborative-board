package com.collab.backend.config;

import com.collab.backend.model.Room;
import com.collab.backend.model.User;
import com.collab.backend.repository.ActiveUserRepository;
import com.collab.backend.repository.RoomParticipantRepository;
import com.collab.backend.repository.RoomRepository;
import com.collab.backend.repository.UserRepository;
import com.collab.backend.security.CustomUserDetailsService;
import com.collab.backend.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class JwtChannelInterceptor implements ChannelInterceptor {
    private static final Logger logger = LoggerFactory.getLogger(JwtChannelInterceptor.class);

    private final JwtTokenProvider jwtTokenProvider;
    private final CustomUserDetailsService userDetailsService;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final RoomParticipantRepository roomParticipantRepository;
    private final ActiveUserRepository activeUserRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel){

        // Use MessageHeaderAccessor so that header/user changes are preserved
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {

            String authHeader = accessor.getFirstNativeHeader("Authorization");

            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                throw new IllegalArgumentException("Missing or invalid Authorization header");
            }

            String token = authHeader.substring(7);

            if (!jwtTokenProvider.validateToken(token)) {
                throw new IllegalArgumentException("Invalid JWT token");
            }

            String username = jwtTokenProvider.getEmailFromToken(token);

            UserDetails userDetails =
                    userDetailsService.loadUserByUsername(username);

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities()
                    );

            accessor.setUser(authentication);
            // Ensure the modified headers (including simpUser) are kept
            accessor.setLeaveMutable(true);
        }
        else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String destination = accessor.getDestination();
            if (destination == null || !destination.startsWith("/topic/room/")) {
                return message;
            }

            String roomId = extractRoomId(destination);
            if (roomId == null || roomId.isBlank()) {
                throw new IllegalArgumentException("Invalid room destination");
            }

            Principal principal = accessor.getUser();
            if (principal == null) {
                throw new IllegalStateException("Unauthenticated WebSocket subscription");
            }

            if (!hasRoomAccess(principal.getName(), roomId)) {
                logger.warn("Denied WS SUBSCRIBE user={} destination={}", principal.getName(), destination);
                throw new IllegalArgumentException("You do not have access to this room");
            }
        }

        return message;
    }

    private String extractRoomId(String destination) {
        // Expected: /topic/room/{roomId}[/...]
        String[] parts = destination.split("/");
        if (parts.length < 4) {
            return null;
        }
        return parts[3];
    }

    private boolean hasRoomAccess(String email, String roomId) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        Optional<Room> roomOpt = roomRepository.findByRoomIdWithOwner(roomId);

        if (userOpt.isEmpty() || roomOpt.isEmpty()) {
            return false;
        }

        User user = userOpt.get();
        Room room = roomOpt.get();
        boolean isOwner = room.getOwner().getId().equals(user.getId());
        boolean isParticipant = roomParticipantRepository.findByUserAndRoom(user, room).isPresent();
        boolean isActiveInRoom = activeUserRepository.existsByRoom_RoomIdAndUserName(roomId, email);

        return isOwner || isParticipant || isActiveInRoom;
    }


}
