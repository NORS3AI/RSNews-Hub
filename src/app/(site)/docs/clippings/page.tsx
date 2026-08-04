import ClippingsList from '@/components/site/ClippingsList';

export const metadata = { title: 'Clippings' };

export default function ClippingsPage() {
  return (
    <div className="container-page py-8 sm:py-10">
      <ClippingsList />
    </div>
  );
}
