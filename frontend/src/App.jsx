import { useEffect, useState } from 'react';
import './App.css';

function ServiceCard({ name, status }) {
  const healthy = status === 'UP';

  return (
    <section className="card">
      <h2>{name}</h2>
      <div className={healthy ? 'status healthy' : 'status unhealthy'}>
        {status}
      </div>
    </section>
  );
}

function App() {
  const [webStatus, setWebStatus] = useState('CHECKING');
  const [aiStatus, setAiStatus] = useState('CHECKING');

  useEffect(() => {
    fetch('http://localhost:3000/api/web/health')
      .then((response) => response.json())
      .then((data) => setWebStatus(data.status || 'DOWN'))
      .catch(() => setWebStatus('DOWN'));

    fetch('http://localhost:3000/api/ai/health')
      .then((response) => response.json())
      .then((data) => setAiStatus(data.status || 'DOWN'))
      .catch(() => setAiStatus('DOWN'));
  }, []);

  return (
    <div className="app">
      <header>
        <h1>AutoHeal AI</h1>
        <p>Autonomous Web Application Recovery System</p>
      </header>

      <main>
        <div className="summary">
          <h2>System Overview</h2>
          <p>
            Monitor application health and prepare for autonomous
            fault diagnosis and recovery.
          </p>
        </div>

        <div className="services">
          <ServiceCard name="Web Service" status={webStatus} />
          <ServiceCard name="AI Service" status={aiStatus} />

          <section className="card">
            <h2>Recovery Engine</h2>
            <div className="status pending">NOT CONNECTED</div>
            <p>Will be enabled in later phases.</p>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
