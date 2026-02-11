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
@Table(
        name = "active_user",
uniqueConstraints = {
@UniqueConstraint(columnNames = {"room_id", "session_id"})
  }
)
public class ActiveUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    // Link to authenticated user (optional for backward compatibility)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

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

    // NEW: Constructor with User
    public ActiveUser(Room room, User user, String sessionId, String color) {
        this.room = room;
        this.user = user;
        this.userName = user.getName();
        this.sessionId = sessionId;
        this.color = color;
        this.joinedAt = LocalDateTime.now();
    }

    public void setUser(User user) {
        this.user = user;
        if (user != null) {
            this.userName = user.getName();
        }
    }
}
