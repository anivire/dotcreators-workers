import {
  cronFetchArtistSuggestion,
  cronUpdateStats,
} from './services/cronService';
import { logger } from './utils';

logger('Service started.');

// Start cron services
cronFetchArtistSuggestion();
cronUpdateStats();
