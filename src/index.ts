import {
  cronFetchArtistSuggestion,
  cronUpdateStats,
} from './services/cronService';
import { SupabaseService } from './services/supabaseService';
import { TwitterService } from './services/twitterService';
import { logger } from './utils';
import { TwitterOpenApi } from 'twitter-openapi-typescript';

logger('Service started.');
// cronFetchArtistSuggestion();
// cronUpdateStats();

const x = new TwitterService();

async function test() {
  const user = await x.getTwitterProfileByUsername('NOP_Pixels');
  console.log(user);
}

test();
