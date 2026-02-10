package com.collab.backend.model;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@AllArgsConstructor
@Entity
@Table(name = "active_user")
public class ActiveUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(name = "user_name", length = 50, nullable = false)
    private String userName;

    @Column(name = "session_id", length = 100, nullable = false)
    private String sessionId;

    @Column(name = "joined_at")
    private LocalDateTime joinedAt;

    @Column(name = "color", length = 7)
    private String color;

    // Constructors
    public ActiveUser() {
        this.joinedAt = LocalDateTime.now();
    }
    public ActiveUser(Room room, String userName, String sessionId, String color) {
        this.room = room;
        this.userName = userName;
        this.sessionId = sessionId;
        this.color = color;
        this.joinedAt = LocalDateTime.now();
    }
}
