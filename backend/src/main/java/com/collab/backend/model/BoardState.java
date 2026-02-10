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
@Table(name = "board_state")
public class BoardState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(name = "page_number")
    private Integer pageNumber = 1;

    @Lob
    @Column(name = "canvas_data", columnDefinition = "TEXT")
    private String canvasData;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Constructors
    public BoardState() {
        this.updatedAt = LocalDateTime.now();
    }

}
