package com.collab.backend.repository;

import com.collab.backend.model.ChatMessage;
import com.collab.backend.model.Room;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    Page<ChatMessage> findByRoomOrderByCreatedAtDesc(Room room, Pageable pageable);

    Page<ChatMessage> findByRoom_RoomIdOrderByCreatedAtDesc(String roomId, Pageable pageable);

    void deleteByRoom_RoomId(String roomId);
}
