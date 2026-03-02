package com.collab.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "active_user",
        uniqueConstraints = {
                // FIX: Was @UniqueConstraint(columnNames = {"user_name"}) — globally unique
                // across ALL rooms. A single ghost record permanently blocked that username
                // from joining anywhere, and the DB threw a constraint violation before
                // app logic could even attempt cleanup. Now unique per-room only.
                @UniqueConstraint(name = "uq_active_user_room_username", columnNames = {"room_id", "user_name"}),
                @UniqueConstraint(name = "uq_active_user_room_session",  columnNames = {"room_id", "session_id"})
        }
)
public class ActiveUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

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

    // FIX: Added for stale-session detection. Scheduler evicts records where
    // lastHeartbeat is older than N minutes (covers server-restart ghost sessions).
    @Column(name = "last_heartbeat")
    private LocalDateTime lastHeartbeat;

    public ActiveUser() {
        this.joinedAt = LocalDateTime.now();
        this.lastHeartbeat = LocalDateTime.now();
    }

    public ActiveUser(Room room, String userName, String sessionId, String color) {
        this.room = room;
        this.userName = userName;
        this.sessionId = sessionId;
        this.color = color;
        this.joinedAt = LocalDateTime.now();
        this.lastHeartbeat = LocalDateTime.now();
    }

    public ActiveUser(Room room, User user, String sessionId, String color) {
        this.room = room;
        this.user = user;
        this.userName = user.getName();
        this.sessionId = sessionId;
        this.color = color;
        this.joinedAt = LocalDateTime.now();
        this.lastHeartbeat = LocalDateTime.now();
    }

    public void setUser(User user) {
        this.user = user;
        if (user != null) this.userName = user.getName();
    }

    public void refreshHeartbeat() {
        this.lastHeartbeat = LocalDateTime.now();
    }
}