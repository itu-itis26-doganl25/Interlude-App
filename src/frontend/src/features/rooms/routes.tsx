import { Route } from 'react-router-dom';
import { paths } from '../../app/paths';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';

// Ownership: real-time/listening-room developer. Replace temporary elements here.
export const roomRoutes = [
  <Route key="rooms" path={paths.rooms} element={
    <FeaturePlaceholder label="TOGETHER" title="Listening rooms" icon="rooms"
      description="Find a shared space to listen and talk about music."
      detail="The rooms owner will add room listing, creation and joining controls." />
  } />,
  <Route key="room" path={paths.room} element={
    <FeaturePlaceholder label="TOGETHER" title="Inside a room" icon="rooms"
      description="Listen in sync with others and chat in real time."
      detail="Presence, WebSocket chat and synchronized playback will be implemented by the rooms team." />
  } />,
];
