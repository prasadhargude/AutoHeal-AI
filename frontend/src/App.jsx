import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [status, setStatus] = useState('Checking...');

  useEffect(() => {
    fetch('http://localhost:3000/api/web/health')
      .then((response) => response.json())
      .then((data) => {
        setStatus(data.status === 'UP' ? 'Healthy' : 'Unavailable');
      })
      .catch(() => {
        setStatus('Unavailable');
      });
  }, []);

  return (
    <div className="app">
      <header>
        <h1>AutoHeal AI</h1>
        <p>Autonomous Web Application Recovery System</p>
      </header>

      <main>
        <section className="card">
          <h2>System Status</h2>
          <div className="status">{status}</div>
          <p>Web Service</p>
        </section>

        <section className="card">
          <h2>Architecture</h2>
          <p>Frontend &rarr; API Gateway &rarr; Web Service</p>
        </section>

        <section className="card">
          <h2>Recovery Engine</h2>
          <div className="status">Not Connected</div>
          <p>AI diagnosis and recovery will be added in later phases.</p>
        </section>
      </main>
    </div>
  );
}

export default App;
