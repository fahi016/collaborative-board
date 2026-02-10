package com.collab.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class ErrorResponse {

    private String error;       // machine-readable error code
    private String message;     // human-readable message
    private LocalDateTime timestamp;
}
