package com.collab.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RoomCreateResponse {
    private String roomId;
    private LocalDateTime createdAt;
    private Integer maxUsers;
}
