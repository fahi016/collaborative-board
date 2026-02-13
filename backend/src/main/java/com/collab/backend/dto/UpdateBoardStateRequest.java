package com.collab.backend.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class UpdateBoardStateRequest {

    @NotNull(message = "pageNumber is required")
    @Min(value = 1, message = "pageNumber must be at least 1")
    private Integer pageNumber = 1;

    @NotBlank(message = "canvasData is required")
    @Size(max = 500_000, message = "canvasData is too large")
    private String canvasData;
}
