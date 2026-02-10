package com.collab.backend.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class UpdateBoardStateRequest {
    private Integer pageNumber = 1;
    private String canvasData;
}
