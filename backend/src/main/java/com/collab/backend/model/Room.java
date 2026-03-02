package com.collab.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@AllArgsConstructor
@Getter
@Setter
@Table(name = "room")
public class Room {
    @Id
    @Column(name = "room_id", length = 36)
    private String roomId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "max_users")
    private Integer maxUsers = 6;

    @Column(name = "current_users")
    private Integer currentUsers = 0;

    @Column(name = "name", length = 100)
    private String name;

    // Constructors
    public Room() {
        this.createdAt = LocalDateTime.now();
    }

    public Room(String roomId, User owner) {
        this.roomId = roomId;
        this.owner = owner;
        this.createdAt = LocalDateTime.now();
        this.maxUsers = 6;
        this.currentUsers = 0;
        this.name = null;
    }

    public Room(String roomId, User owner, String name) {
        this.roomId = roomId;
        this.owner = owner;
        this.createdAt = LocalDateTime.now();
        this.maxUsers = 6;
        this.currentUsers = 0;
        this.name = name;
    }

    //Helper methods
    public void incrementUserCount(){
        this.currentUsers++;
    }
    public void decrementUserCount(){
        if (this.currentUsers > 0) {
            this.currentUsers--;
        }
    }
    public boolean isFull() {
        return this.currentUsers >= this.maxUsers;
    }


}
