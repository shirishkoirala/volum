import { useState, useEffect, useCallback } from 'react';
import {
  listFavorites,
  addFavorite as apiAddFavorite,
  removeFavorite as apiRemoveFavorite,
} from '../api/client-services';

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    listFavorites()
      .then(setFavorites)
      .catch(() => setFavorites([]));
  }, []);

  const addFavorite = useCallback(
    (path: string) => {
      if (!favorites.includes(path)) {
        setFavorites((prev) => [...prev, path]);
      }
      apiAddFavorite(path).catch(() => {
        listFavorites().then(setFavorites);
      });
    },
    [favorites],
  );

  const removeFavorite = useCallback((path: string) => {
    setFavorites((prev) => prev.filter((f) => f !== path));
    apiRemoveFavorite(path).catch(() => {
      listFavorites().then(setFavorites);
    });
  }, []);

  return {
    favorites,
    addFavorite,
    removeFavorite,
  };
}
