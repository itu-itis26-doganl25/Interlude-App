import { mockAuthService } from './authService';
import { mockMusicService } from './musicService';

export const authService = mockAuthService;   // → apiAuthService
export const musicService = mockMusicService; // → apiMusicService

export * from './authService';
export * from './musicService';