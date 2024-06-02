import {
  cronFetchArtistSuggestion,
  cronUpdateStats,
} from './services/cronService';
import { sendDiscordMessage } from './services/webhookService';
import { logger } from './utils';

logger('Service started.');
sendDiscordMessage('Service started', 'dotcreators worker service is online!');
cronUpdateStats();
cronFetchArtistSuggestion();
