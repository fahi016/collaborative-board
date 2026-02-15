package com.collab.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Persisted chat message for a room. Used for history and audit.
 */
@Entity
@Table(name = "chat_message", indexes = {
        @Index(name = "idx_chat_message_room_created", columnList = "room_id, created_at DESC")
})
@Getter
@Setter
@NoArgsConstructor
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Column(name = "content", nullable = false, length = 2000)
    private String content;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public ChatMessage(Room room, User sender, String content) {
        this.room = room;
        this.sender = sender;
        this.content = content;
        this.createdAt = LocalDateTime.now();
    }
}
