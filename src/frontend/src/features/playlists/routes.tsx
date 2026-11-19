import { Route } from 'react-router-dom';
import { paths } from '../../app/paths';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';

// FR-47/48: route shells only. Playlist features belong to player and profiles owners.
export const playlistRoutes = [
  <Route key="playlists" path={paths.playlists} element={
    <FeaturePlaceholder label="YOUR LIBRARY" title="My playlists" icon="music"
      description="Organize your favourite tracks."
      detail="The playlist owner will add creation, ordering, visibility and playback here." />
  } />,
  <Route key="playlist" path={paths.playlist} element={
    <FeaturePlaceholder label="YOUR LIBRARY" title="Playlist details" icon="music"
      description="A playlist's songs and controls will appear here."
      detail="The player team will integrate playlist tracks and queue behavior." />
  } />,
];
