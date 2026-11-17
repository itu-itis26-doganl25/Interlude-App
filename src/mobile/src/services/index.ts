import { mockAuthService } from './authService';
import { mockMusicService } from './musicService';
import { mockStudioService } from './studioService';
import { mockUserService } from './userService';

export const authService = mockAuthService;     // → apiAuthService
export const musicService = mockMusicService;   // → apiMusicService
export const userService = mockUserService;     // → apiUserService
export const studioService = mockStudioService; // → apiStudioService

export * from './authService';
export * from './musicService';
export * from './userService';
export * from './studioService';

import { mockLibraryService, type LibraryService } from './libraryService';
import { mockListeningService, type ListeningService } from './listeningService';
import { mockRecommendationService, type RecommendationService } from './recommendationService';

export type { Library } from './libraryService';
export type { ListeningReport } from './listeningService';
export type { UpNextParams } from './recommendationService';

export const libraryService: LibraryService = mockLibraryService;
export const recommendationService: RecommendationService = mockRecommendationService;
export const listeningService: ListeningService = mockListeningService;