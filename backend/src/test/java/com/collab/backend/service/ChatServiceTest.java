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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock
    private ChatMessageRepository chatMessageRepository;
    @Mock
    private RoomRepository roomRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ActiveUserRepository activeUserRepository;

    @InjectMocks
    private ChatService chatService;

    private static final String ROOM_ID = "ABC1234567";
    private static final String SENDER_EMAIL = "alice@example.com";
    private static final String CONTENT = "Hello, room!";

    private Room room;
    private User user;
    private ChatMessage savedMessage;

    @BeforeEach
    void setUp() {
        room = new Room();
        room.setRoomId(ROOM_ID);
        user = new User();
        user.setId(1L);
        user.setEmail(SENDER_EMAIL);
        user.setName("Alice");
        savedMessage = new ChatMessage(room, user, CONTENT);
        savedMessage.setId(100L);
        savedMessage.setCreatedAt(LocalDateTime.now());
    }

    @Nested
    @DisplayName("sendMessage")
    class SendMessage {

        @Test
        @DisplayName("saves and returns response when user is in room")
        void success() {
            when(roomRepository.findByRoomId(ROOM_ID)).thenReturn(Optional.of(room));
            when(userRepository.findByEmail(SENDER_EMAIL)).thenReturn(Optional.of(user));
            when(activeUserRepository.existsByRoom_RoomIdAndUserName(ROOM_ID, SENDER_EMAIL)).thenReturn(true);
            when(chatMessageRepository.save(any(ChatMessage.class))).thenReturn(savedMessage);

            ChatMessageResponse response = chatService.sendMessage(ROOM_ID, SENDER_EMAIL, CONTENT);

            assertThat(response).isNotNull();
            assertThat(response.getId()).isEqualTo(100L);
            assertThat(response.getRoomId()).isEqualTo(ROOM_ID);
            assertThat(response.getSenderId()).isEqualTo(1L);
            assertThat(response.getSenderName()).isEqualTo("Alice");
            assertThat(response.getContent()).isEqualTo(CONTENT);
            assertThat(response.getCreatedAt()).isNotNull();
            verify(chatMessageRepository).save(any(ChatMessage.class));
        }

        @Test
        @DisplayName("trims content")
        void trimsContent() {
            when(roomRepository.findByRoomId(ROOM_ID)).thenReturn(Optional.of(room));
            when(userRepository.findByEmail(SENDER_EMAIL)).thenReturn(Optional.of(user));
            when(activeUserRepository.existsByRoom_RoomIdAndUserName(ROOM_ID, SENDER_EMAIL)).thenReturn(true);
            when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(inv -> {
                ChatMessage m = inv.getArgument(0);
                assertThat(m.getContent()).isEqualTo("  hi  ".trim());
                return savedMessage;
            });

            chatService.sendMessage(ROOM_ID, SENDER_EMAIL, "  hi  ");
            verify(chatMessageRepository).save(any(ChatMessage.class));
        }

        @Test
        @DisplayName("throws when roomId is blank")
        void invalidRoomIdBlank() {
            assertThatThrownBy(() -> chatService.sendMessage("", SENDER_EMAIL, CONTENT))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Invalid roomId");
        }

        @Test
        @DisplayName("throws when room not found")
        void roomNotFound() {
            when(roomRepository.findByRoomId(ROOM_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> chatService.sendMessage(ROOM_ID, SENDER_EMAIL, CONTENT))
                    .isInstanceOf(RoomNotFoundException.class)
                    .hasMessageContaining("Room not found");
        }

        @Test
        @DisplayName("throws when sender email blank")
        void senderEmailBlank() {
            assertThatThrownBy(() -> chatService.sendMessage(ROOM_ID, "", CONTENT))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Sender email");
        }

        @Test
        @DisplayName("throws when user not found")
        void userNotFound() {
            when(roomRepository.findByRoomId(ROOM_ID)).thenReturn(Optional.of(room));
            when(userRepository.findByEmail(SENDER_EMAIL)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> chatService.sendMessage(ROOM_ID, SENDER_EMAIL, CONTENT))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("User not found");
        }

        @Test
        @DisplayName("throws when user not in room")
        void userNotInRoom() {
            when(roomRepository.findByRoomId(ROOM_ID)).thenReturn(Optional.of(room));
            when(userRepository.findByEmail(SENDER_EMAIL)).thenReturn(Optional.of(user));
            when(activeUserRepository.existsByRoom_RoomIdAndUserName(ROOM_ID, SENDER_EMAIL)).thenReturn(false);

            assertThatThrownBy(() -> chatService.sendMessage(ROOM_ID, SENDER_EMAIL, CONTENT))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not in room");
        }

        @Test
        @DisplayName("throws when content blank")
        void contentBlank() {
            assertThatThrownBy(() -> chatService.sendMessage(ROOM_ID, SENDER_EMAIL, "   "))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("content");
        }

        @Test
        @DisplayName("throws when content exceeds max length")
        void contentTooLong() {
            String longContent = "x".repeat(2001);
            assertThatThrownBy(() -> chatService.sendMessage(ROOM_ID, SENDER_EMAIL, longContent))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("2000");
        }
    }

    @Nested
    @DisplayName("getMessages")
    class GetMessages {

        @Test
        @DisplayName("returns paginated messages when room exists")
        void success() {
            Pageable pageable = PageRequest.of(0, 20);
            when(roomRepository.existsByRoomId(ROOM_ID)).thenReturn(true);
            when(chatMessageRepository.findByRoom_RoomIdOrderByCreatedAtDesc(eq(ROOM_ID), eq(pageable)))
                    .thenReturn(new PageImpl<>(List.of(savedMessage), pageable, 1));

            Page<ChatMessageResponse> page = chatService.getMessages(ROOM_ID, pageable);

            assertThat(page).isNotNull();
            assertThat(page.getContent()).hasSize(1);
            assertThat(page.getContent().get(0).getContent()).isEqualTo(CONTENT);
            assertThat(page.getContent().get(0).getRoomId()).isEqualTo(ROOM_ID);
        }

        @Test
        @DisplayName("throws when roomId blank")
        void invalidRoomIdBlank() {
            assertThatThrownBy(() -> chatService.getMessages("", PageRequest.of(0, 10)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Invalid roomId");
        }

        @Test
        @DisplayName("throws when room not found")
        void roomNotFound() {
            when(roomRepository.existsByRoomId(ROOM_ID)).thenReturn(false);

            assertThatThrownBy(() -> chatService.getMessages(ROOM_ID, PageRequest.of(0, 10)))
                    .isInstanceOf(RoomNotFoundException.class)
                    .hasMessageContaining("Room not found");
        }
    }
}
