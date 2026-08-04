import HistoryList from '@/components/site/HistoryList';

export const metadata = { title: 'History' };

export default function HistoryPage() {
  return (
    <div className="container-page py-8 sm:py-10">
      <HistoryList />
    </div>
  );
}
