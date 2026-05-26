import { useLocalStorage } from './useLocalStorage';

export function useFavorites(currentPath: string, contextEntryPath?: string) {
  const [favorites, setFavorites] = useLocalStorage<string[]>('volum_favorites', []);

  const persistFavorites = (items: string[]) => setFavorites(items);
  const addFavorite = (path: string) => { if (!favorites.includes(path)) persistFavorites([...favorites, path]); };
  const removeFavorite = (path: string) => { persistFavorites(favorites.filter((f) => f !== path)); };

  const isFavorited = favorites.includes(currentPath);
  const selectedEntryIsFavorited = contextEntryPath ? favorites.includes(contextEntryPath) : isFavorited;

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorited,
    selectedEntryIsFavorited,
  };
}
