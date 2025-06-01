import React from 'react';
import './App.css';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Footer from './components/Footer';
import { Analytics } from '@vercel/analytics/react';

function App() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      <main className="flex-grow">
        <Dashboard />
      </main>
      <Footer />
      <Analytics />
    </div>
  );
}

export default App;
