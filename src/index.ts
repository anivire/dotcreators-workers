import {
  cronFetchArtistSuggestion,
  cronUpdateStats,
} from './services/cronService';
import { logger } from './utils';

logger('Service started.');
cronUpdateStats();
cronFetchArtistSuggestion();
