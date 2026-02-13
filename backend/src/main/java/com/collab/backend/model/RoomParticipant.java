package com.collab.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "room_participant",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"room_id", "user_id"})
        }
)
@Getter
@Setter
@NoArgsConstructor
public class RoomParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "first_joined_at", nullable = false)
    private LocalDateTime firstJoinedAt;

    @Column(name = "last_joined_at", nullable = false)
    private LocalDateTime lastJoinedAt;

    public RoomParticipant(Room room, User user) {
        this.room = room;
        this.user = user;
        this.firstJoinedAt = LocalDateTime.now();
        this.lastJoinedAt = this.firstJoinedAt;
    }

    public void touchLastJoined() {
        this.lastJoinedAt = LocalDateTime.now();
    }

}
