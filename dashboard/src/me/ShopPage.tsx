import { Link } from 'react-router';
import { PageHeader, Spinner } from '../components/ui';
import { useMe } from './api';
import { EventHero, ItemBrowser, UpcomingEvents } from './shop';

export default function ShopPage() {
  const { shop } = useMe();
  return (
    <>
      <PageHeader kicker="Mein Profil" title="Shop" description="Hintergründe, Rahmen, Abzeichen und mehr für deine Profilkarte – bezahlt mit Kristallen, die du mit Nexo verdienst."
        actions={<Link to="/me/blackmarket" className="btn btn-secondary hover:no-underline">Zum Black Market</Link>} />
      {!shop ? <Spinner /> : (
        <>
          {shop.events[0] && <div className="mb-8"><EventHero event={shop.events[0]} /></div>}
          <ItemBrowser listings={shop.listings} variant="shop" />
          <UpcomingEvents events={shop.upcoming} />
        </>
      )}
    </>
  );
}
