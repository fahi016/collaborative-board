package com.collab.backend.controller;

import com.collab.backend.dto.AuthResponse;
import com.collab.backend.dto.LoginRequest;
import com.collab.backend.dto.MeResponse;
import com.collab.backend.dto.RegisterRequest;
import com.collab.backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@AllArgsConstructor
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    /**
     * Register new user
     * POST /api/auth/register
     */
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Login user
     * POST /api/auth/login
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Get current user info
     * GET /api/auth/me
     */
    @GetMapping("/me")
    public ResponseEntity<MeResponse> getCurrentUser() {
        var user = authService.getCurrentUser();
        MeResponse response = new MeResponse();
        response.setName(user.getName());
        response.setEmail(user.getEmail());
        response.setUserId(user.getId());
        response.setRole(user.getRole());
        return ResponseEntity.ok(response);
    }
}