import { Route } from 'react-router-dom';
import { paths } from '../../app/paths';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';

// Ownership: auth and profiles developer. Layout and authorization guards are shared.
export const profileRoutes = [
  <Route key="profile" path={paths.profile} element={
    <FeaturePlaceholder label="YOUR SPACE" title="My profile" icon="user"
      description="Your personal space on Interlude."
      detail="The profiles owner will integrate profile, followers and public-playlist controls." />
  } />,
  <Route key="edit-profile" path={paths.editProfile} element={
    <FeaturePlaceholder label="YOUR SPACE" title="Edit profile" icon="user"
      description="Make your profile your own."
      detail="The profiles owner will add editable fields and persistence." />
  } />,
  <Route key="followers" path={paths.followers} element={
    <FeaturePlaceholder label="YOUR SPACE" title="Followers" icon="user"
      description="See who follows you."
      detail="The profiles owner will implement follower listing (FR-45/46)." />
  } />,
  <Route key="following" path={paths.following} element={
    <FeaturePlaceholder label="YOUR SPACE" title="Following" icon="user"
      description="See the people you follow."
      detail="The profiles owner will implement following and unfollowing (FR-45/46)." />
  } />,
  <Route key="user" path={paths.user} element={
    <FeaturePlaceholder label="COMMUNITY" title="User profile" icon="user"
      description="Find the people behind the music."
      detail="The profiles owner will add the public profile and follow button." />
  } />,
  <Route key="musician" path={paths.musician} element={
    <FeaturePlaceholder label="ARTIST SPACE" title="Musician profile" icon="music"
      description="Discover the artist behind the music."
      detail="The profiles owner will include albums, songs and a copyright-report entry point." />
  } />,
  <Route key="report-musician" path={paths.reportMusician} element={
    <FeaturePlaceholder label="SAFETY" title="Report copyright concern" icon="user"
      description="Describe the song and concern for an admin to review."
      detail="The profiles owner will add the report form and backend integration (FR-52)." />
  } />,
];
