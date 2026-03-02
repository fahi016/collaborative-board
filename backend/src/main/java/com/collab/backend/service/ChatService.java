package com.collab.backend.service;

import com.collab.backend.dto.ChatMessageResponse;
import com.collab.backend.exception.RoomNotFoundException;
import com.collab.backend.model.ChatMessage;
import com.collab.backend.model.Room;
import com.collab.backend.model.User;
import com.collab.backend.repository.ActiveUserRepository;
import com.collab.backend.repository.ChatMessageRepository;
import com.collab.backend.repository.RoomRepository;
import com.collab.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ChatService {

    private static final Logger logger = LoggerFactory.getLogger(ChatService.class);

    public static final int MAX_CONTENT_LENGTH = 2000;

    private final ChatMessageRepository chatMessageRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final ActiveUserRepository activeUserRepository;

    /**
     * Sends a chat message in a room. Caller must ensure the sender is in the room (e.g. via session).
     */
    @Transactional
    public ChatMessageResponse sendMessage(String roomId, String senderEmail, String content) {
        if (roomId == null || roomId.isBlank() || roomId.length() > 36) {
            throw new IllegalArgumentException("Invalid roomId");
        }
        if (senderEmail == null || senderEmail.isBlank()) {
            throw new IllegalArgumentException("Sender email is required");
        }
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("Message content is required");
        }
        if (content.length() > MAX_CONTENT_LENGTH) {
            throw new IllegalArgumentException("Message must not exceed " + MAX_CONTENT_LENGTH + " characters");
        }

        Room room = roomRepository.findByRoomId(roomId)
                .orElseThrow(() -> new RoomNotFoundException("Room not found: " + roomId));
        User sender = userRepository.findByEmail(senderEmail)
                .orElseThrow(() -> new IllegalStateException("User not found: " + senderEmail));

        if (!activeUserRepository.existsByRoom_RoomIdAndUserName(roomId, senderEmail)) {
            throw new IllegalStateException("User is not in room");
        }

        ChatMessage message = new ChatMessage(room, sender, content.trim());
        message = chatMessageRepository.save(message);

        logger.info("Chat message sent roomId={} sender={} messageId={}", roomId, senderEmail, message.getId());

        return toResponse(message);
    }

    /**
     * Returns paginated chat history for a room. Caller must enforce access (e.g. only participants).
     */
    @Transactional(readOnly = true)
    public Page<ChatMessageResponse> getMessages(String roomId, Pageable pageable) {
        if (roomId == null || roomId.isBlank() || roomId.length() > 36) {
            throw new IllegalArgumentException("Invalid roomId");
        }

        if (!roomRepository.existsByRoomId(roomId)) {
            throw new RoomNotFoundException("Room not found: " + roomId);
        }

        Page<ChatMessage> page = chatMessageRepository.findByRoom_RoomIdOrderByCreatedAtDesc(roomId, pageable);
        return page.map(this::toResponse);
    }

    private ChatMessageResponse toResponse(ChatMessage m) {
        return new ChatMessageResponse(
                m.getId(),
                m.getRoom().getRoomId(),
                m.getSender().getId(),
                m.getSender().getName(),
                m.getContent(),
                m.getCreatedAt()
        );
    }

    @Transactional
    public void deleteByRoom_RoomId(String roomId) {
        chatMessageRepository.deleteByRoom_RoomId(roomId);
    }
}