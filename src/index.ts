import {
  cronFetchArtistSuggestion,
  cronUpdateStats,
} from './services/cronService';
import { logger } from './utils';

logger('Service started.');
// sendDiscordMessage('Service started', 'dotcreators worker service is online!');
cronUpdateStats();
cronFetchArtistSuggestion();
