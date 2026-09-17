import FavoritesList from '@/components/site/FavoritesList';

export const metadata = { title: 'Favorites' };

export default function FavoritesPage() {
  return (
    <div className="container-page py-8 sm:py-10">
      <FavoritesList />
    </div>
  );
}
