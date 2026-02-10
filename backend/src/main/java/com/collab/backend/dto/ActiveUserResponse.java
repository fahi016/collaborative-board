package com.collab.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class ActiveUserResponse {
    private String userName;
    private String color;
    private LocalDateTime joinedAt;
}
