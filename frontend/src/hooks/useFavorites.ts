import { useState, useEffect, useCallback } from 'react';
import { listFavorites, addFavorite as apiAddFavorite, removeFavorite as apiRemoveFavorite } from '../api/client';

export function useFavorites(currentPath: string, contextEntryPath?: string) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listFavorites()
      .then(setFavorites)
      .catch(() => setFavorites([]))
      .finally(() => setLoading(false));
  }, []);

  const addFavorite = useCallback((path: string) => {
    if (!favorites.includes(path)) {
      setFavorites(prev => [...prev, path]);
    }
    apiAddFavorite(path).catch(() => {
      listFavorites().then(setFavorites);
    });
  }, [favorites]);

  const removeFavorite = useCallback((path: string) => {
    setFavorites(prev => prev.filter(f => f !== path));
    apiRemoveFavorite(path).catch(() => {
      listFavorites().then(setFavorites);
    });
  }, []);

  const isFavorited = favorites.includes(currentPath);
  const selectedEntryIsFavorited = contextEntryPath ? favorites.includes(contextEntryPath) : isFavorited;

  return {
    favorites,
    loading,
    addFavorite,
    removeFavorite,
    isFavorited,
    selectedEntryIsFavorited,
  };
}
