import {
  cronFetchArtistSuggestion,
  cronUpdateStats,
} from './services/cronService';
import { test } from './services/twitterService';
import { logger } from './utils';

logger('Service started.');
// test();
// sendDiscordMessage('Service started', 'dotcreators worker service is online!');
cronUpdateStats();
cronFetchArtistSuggestion();
