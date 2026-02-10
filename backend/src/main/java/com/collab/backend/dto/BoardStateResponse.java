package com.collab.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class BoardStateResponse {
    private String canvasData;
    private Integer pageNumber;
    private LocalDateTime updatedAt;
}
