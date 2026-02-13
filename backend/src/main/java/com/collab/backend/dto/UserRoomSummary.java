package com.collab.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class UserRoomSummary {
    private String roomId;
    private String name;
    private Integer currentUsers;
    private Integer maxUsers;
    private LocalDateTime createdAt;
    private boolean full;
    private boolean owner;          // true if user created the room
    private LocalDateTime lastJoinedAt; // for joined rooms (owner might be null)
}