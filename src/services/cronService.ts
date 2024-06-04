import cron from 'node-cron';
import { logger } from '../utils';
import { SupabaseService } from './supabaseService';
import { TwitterService } from './twitterService';
import { Profile } from '@the-convocation/twitter-scraper';
import { sendDiscordMessage } from './webhookService';

const EVERY_HOURS = 24;
const RUN_ON_INIT = true;

const supabase = new SupabaseService();
const twitter = new TwitterService();

export function cronUpdateStats() {
  cron.schedule(
    `0 0 */${EVERY_HOURS} * * *`,
    async () => {
      logger(`Start fetching artists profiles...`);
      let page = 1;
      let artistsNewData: Profile[] = [];
      let morePages = true;

      while (morePages) {
        const artistsProfiles = await supabase.getArtistsProfilesPaginated(
          page
        );

        if (artistsProfiles && artistsProfiles.data.length > 0) {
          for (const [index, artist] of artistsProfiles.data.entries()) {
            logger(
              `[${index + 1}/${
                artistsProfiles.data.length
              }] Start fetching twitter data for ${artist.username}...`
            );

            try {
              const artistData = await twitter.getTwitterProfile(
                artist.username
              );
              if (artistData) {
                artistsNewData.push(artistData);
                logger(
                  `[${index + 1}/${
                    artistsProfiles.data.length
                  }] Data fetched for ${
                    artist.username
                  }, added to profile update queue.`
                );
              }
            } catch (error) {
              logger(`Error fetching data for ${artist.username}: ${error}`);
            }
          }

          page++;
        } else {
          morePages = false;
        }
      }

      if (artistsNewData.length > 0) {
        logger(`Updating ${artistsNewData.length} profiles...`);
        try {
          await supabase.updateArtistProfiles(artistsNewData);
          logger(`Successfully updated ${artistsNewData.length} profiles.`);
          sendDiscordMessage(
            'Update user profiles and trends',
            `Successfully updated ${artistsNewData.length} profiles`
          );
          artistsNewData = [];
        } catch (error) {
          logger(`Error while updating profiles: ${error}`);
          sendDiscordMessage(
            'Error while updating profiles',
            error as unknown as string
          );
        }
      } else {
        logger('No new artist data to update.');
      }
    },
    {
      name: 'Update followers and tweets count for artists (pfp/banner/bio and etc).',
      runOnInit: RUN_ON_INIT,
    }
  );
}

export function cronFetchArtistSuggestion() {
  cron.schedule(
    `0 0 */${EVERY_HOURS} * * *`,
    async () => {
      logger(`Start fetching suggested artists profiles...`);

      const artistsSuggestions = await supabase.getArtistsSuggestions();

      if (artistsSuggestions) {
        if (artistsSuggestions.length === 0) {
          logger(`Received 0 artist suggestions, skip fetching.`);
          sendDiscordMessage(
            'Artists suggestions',
            'Received 0 artist suggestions, skip fetching'
          );
          return;
        }

        logger(
          `Received ${artistsSuggestions.length} artist suggestion(s), start fetching twitter data.`
        );

        // const artistsNewData: Profile[] = [];
        for (const [index, artist] of artistsSuggestions.entries()) {
          logger(
            `[${index + 1}/${
              artistsSuggestions.length
            }] Start fetching twitter data for ${artist.username}...`
          );
          try {
            const artistData = await twitter.getTwitterProfile(artist.username);
            if (artistData) {
              logger(
                `[${index + 1}/${artistsSuggestions.length}] Data fetched for ${
                  artist.username
                }, creating profile...`
              );
              let isProfileCreated = await supabase.createArtistInstance(
                {
                  tags: artist.tags,
                  country: artist.country,
                  bio: artistData.biography || null,
                  followersCount: artistData.followersCount || 0,
                  tweetsCount: artistData.tweetsCount || 0,
                  images: {
                    avatar: artistData.avatar || null,
                    banner: artistData.banner || null,
                  },
                  name: artistData.name || null,
                  url: artistData.url || 'https://x.com/' + artistData.username,
                  website: artistData.website || null,
                  joinedAt: new Date(artistData.joined!) || null,
                  username: artistData.username!,
                  userId: artistData.userId!,
                  lastUpdatedAt: new Date(),
                  createdAt: new Date(),
                  weeklyFollowersGrowingTrend: 0,
                  weeklyPostsGrowingTrend: 0,
                },
                artist.requestId
              );

              if (isProfileCreated) {
                logger(
                  `[${index + 1}/${artistsSuggestions.length}] ${
                    artist.username
                  } profile is successfully created!`
                );
              } else {
                logger(
                  `Unable to create profile for ${artist.username}, skipping...`
                );
              }
            } else {
              logger(
                `Unable to fetch data for ${artist.username}, skipping...`
              );
            }
          } catch (error) {
            logger(`Error fetching data for ${artist.username}: ${error}`);
          }
        }

        sendDiscordMessage(
          'Artists suggestions',
          `Created ${artistsSuggestions.length} new artist suggestions`
        );
      } else {
        logger(`Unable to fetch profiles, skipping...`);
      }
    },
    {
      name: 'Fetching suggested artists profiles.',
      runOnInit: RUN_ON_INIT,
    }
  );
}
