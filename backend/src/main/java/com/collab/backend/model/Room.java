package com.collab.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
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

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "max_users")
    private Integer maxUsers = 3;

    @Column(name = "current_users")
    private Integer currentUsers = 0;

    // Constructors
    public Room() {
        this.createdAt = LocalDateTime.now();
    }

    public Room(String roomId) {
        this.roomId = roomId;
        this.createdAt = LocalDateTime.now();
        this.maxUsers = 3;
        this.currentUsers = 0;
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
