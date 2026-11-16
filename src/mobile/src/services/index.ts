import { mockAuthService } from './authService';
import { mockMusicService } from './musicService';
import { mockUserService } from './userService';

export const authService = mockAuthService;   // → apiAuthService
export const musicService = mockMusicService; // → apiMusicService
export const userService = mockUserService;   // → apiUserService

export * from './authService';
export * from './musicService';
export * from './userService';