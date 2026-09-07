import React from 'react';
import {createRoot} from 'react-dom/client';
import CampaignApp from '../app/campaign-app';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(<CampaignApp/>);
