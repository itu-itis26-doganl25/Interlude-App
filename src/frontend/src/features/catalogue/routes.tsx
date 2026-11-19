import { Route, useSearchParams } from 'react-router-dom';
import { paths } from '../../app/paths';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';

function SearchPlaceholder() {
  const [params] = useSearchParams();
  const query = params.get('q')?.trim();
  return (
    <FeaturePlaceholder label="DISCOVER" title="Search music" icon="search"
      description={query ? `Searching for “${query}”` : 'Discover songs, albums and artists.'}
      detail="The catalogue owner will connect this route to the search API, with result, empty and loading states." />
  );
}

// Ownership: catalogue/streaming developer. Replace temporary page elements here.
export const catalogueRoutes = [
  <Route key="catalogue" path={paths.catalogue} element={
    <FeaturePlaceholder label="DISCOVER" title="Music catalogue" icon="music"
      description="Browse music from independent artists."
      detail="Catalogue listing, sorting, filters and pagination will be implemented by the catalogue team." />
  } />,
  <Route key="search" path={paths.search} element={<SearchPlaceholder />} />,
  <Route key="track" path={paths.track} element={
    <FeaturePlaceholder label="NOW PLAYING" title="Track details" icon="headphones"
      description="Track metadata and playback live here."
      detail="The player and streaming integration belong to the catalogue/player workstream." />
  } />,
  <Route key="album" path={paths.album} element={
    <FeaturePlaceholder label="DISCOVER" title="Album details" icon="disc"
      description="Explore an album and its tracks."
      detail="The catalogue team will display album metadata and its tracks." />
  } />,
];
