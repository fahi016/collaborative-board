package com.collab.backend.dto;

import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class RoomInfoResponse {
    private final String roomId;
    private final String name;
    private final Integer currentUsers;
    private final Integer maxUsers;
    private final LocalDateTime createdAt;
    private final boolean isFull;
    private final Long ownerId;
    private final String ownerName;  // display name / email of the creator

    /**
     * Original constructor (kept for backward compat — sets owner fields to null).
     * Prefer the full constructor wherever Room is available.
     */
    public RoomInfoResponse(String roomId, String name, Integer currentUsers,
                            Integer maxUsers, LocalDateTime createdAt, boolean isFull) {
        this(roomId, name, currentUsers, maxUsers, createdAt, isFull, null, null);
    }

    public RoomInfoResponse(String roomId, String name, Integer currentUsers,
                            Integer maxUsers, LocalDateTime createdAt, boolean isFull,
                            Long ownerId, String ownerName) {
        this.roomId = roomId;
        this.name = name;
        this.currentUsers = currentUsers;
        this.maxUsers = maxUsers;
        this.createdAt = createdAt;
        this.isFull = isFull;
        this.ownerId = ownerId;
        this.ownerName = ownerName;
    }
}