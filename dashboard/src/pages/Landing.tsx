import { useContext } from 'react';
import { Navigate } from 'react-router';
import { UserContext } from '../api';
import { Icon } from '../icons';

export function Landing() {
  const user = useContext(UserContext);
  const loginFailed = new URLSearchParams(location.search).get('error') === 'login';
  if (user) return <Navigate to="/servers" replace />;

  return (
    <div className="landing">
      <div className="landing-nav"><img src="/dashboard/nexo.svg" alt="" /> Nexo</div>
      <div className="landing-hero">
        <div>
          <img className="robot" src="/dashboard/nexo.svg" alt="Nexo" />
          <h1>Ein Bot. <span className="grad">Alle Funktionen.</span></h1>
          <p>Richte Nexo bequem im Browser ein: Willkommensnachrichten, Leveling, AutoMod, Tickets und alles andere – ohne einen einzigen Befehl.</p>
          {loginFailed && <div className="notice danger" style={{ maxWidth: 420, margin: '0 auto 20px' }}>Die Anmeldung hat nicht geklappt. Bitte versuch es noch einmal.</div>}
          <div className="landing-actions">
            <a className="btn btn-gradient btn-lg" href="/dashboard/auth/invite"><Icon name="plus" size={20} /> Nexo einladen</a>
            <a className="btn btn-secondary btn-lg" href="/dashboard/auth/login"><DiscordLogo /> Mit Discord anmelden</a>
          </div>
          <p className="faint landing-hint">Nach dem Einladen landest du direkt im Dashboard deines Servers.</p>
          <div className="feature-row">
            {['Moderation & AutoMod', 'Willkommen', 'Leveling', 'Tickets', 'Verifizierung', 'Giveaways', 'Musik'].map((f) => <span key={f}>{f}</span>)}
          </div>
          <p className="faint" style={{ marginTop: 28 }}><Icon name="shield" size={14} /> Nexo liest nur deinen Discord-Namen und deine Serverliste.</p>
        </div>
      </div>
    </div>
  );
}

function DiscordLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.2a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.8 19.8 0 0 0 6-3c.5-5.1-.8-9.6-3.6-13.6zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z" />
    </svg>
  );
}
