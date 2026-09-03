import React from 'react';
import { createRoot } from 'react-dom/client';
import MusicTimeline from './MusicTimeline.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MusicTimeline />
  </React.StrictMode>
);
