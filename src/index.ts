import { cronFetchArtistSuggestion, cronUpdateStats } from './cronService';
import { logger } from './utils';

logger('Service started.');
cronUpdateStats();
cronFetchArtistSuggestion();
