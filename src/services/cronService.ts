import cron from 'node-cron';
import { logger } from '../utils';
import { SupabaseService } from './supabaseService';
import { TwitterService } from './twitterService';
import { Profile } from '@the-convocation/twitter-scraper';
import { sendDiscordMessage } from './webhookService';

const IS_RUN_ON_INIT = process.env.RUN_ON_INIT;

const EVERY_HOURS = 24;
const RUN_ON_INIT = IS_RUN_ON_INIT === 'true' ? true : false;

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
          const fetchPromises = artistsProfiles.data.map(
            async (artist, index) => {
              logger(
                `[${index + 1}/${
                  artistsProfiles.data.length
                }] Start fetching twitter data for ${artist.username}...`
              );

              try {
                const artistData = await twitter.getTwitterProfileLegacy(
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
              } catch (e) {
                logger(`Error fetching data for ${artist.username}: ${e}`);
                if (e instanceof Error) {
                  sendDiscordMessage(
                    e.name,
                    `${e.message}\n\n\`username: ${artist.username}\``,
                    'error'
                  );
                } else {
                  sendDiscordMessage('UnknownError', `${e}`, 'error');
                }
              }
            }
          );

          await Promise.all(fetchPromises);
          page++;
        } else {
          morePages = false;
        }
      }

      if (artistsNewData.length > 0) {
        logger(`Updating ${artistsNewData.length} profiles...`);
        try {
          await supabase.updateArtistProfiles(artistsNewData);
          await supabase.createArtistTrends(artistsNewData);
          await supabase.updateArtistsTrendPercent();

          await supabase.updateAnalyticsArtists(artistsNewData.length);
          logger(`Successfully updated ${artistsNewData.length} profiles.`);
          sendDiscordMessage(
            'Update user profiles and trends',
            `Successfully updated ${artistsNewData.length} profiles`,
            'info'
          );
          artistsNewData = [];
        } catch (e) {
          logger(`Error while updating profiles: ${e}`);
          if (e instanceof Error) {
            sendDiscordMessage(
              'Error while updating profiles',
              `${e.message}`,
              'error'
            );
          } else {
            sendDiscordMessage('UnknownError', `${e}`, 'error');
          }
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
            'Received 0 artist suggestions, skip fetching',
            'info'
          );
          return;
        }

        logger(
          `Received ${artistsSuggestions.length} artist suggestion(s), start fetching twitter data.`
        );

        if (artistsSuggestions && artistsSuggestions.length > 0) {
          const fetchAndCreatePromises = artistsSuggestions.map(
            async (artist, index) => {
              logger(
                `[${index + 1}/${
                  artistsSuggestions.length
                }] Start fetching twitter data for ${artist.username}...`
              );

              try {
                const artistData = await twitter.getTwitterProfileLegacy(
                  artist.username
                );
                if (artistData) {
                  logger(
                    `[${index + 1}/${
                      artistsSuggestions.length
                    }] Data fetched for ${artist.username}, creating profile...`
                  );

                  const isProfileCreated = await supabase.createArtistInstance(
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
                      url:
                        artistData.url ||
                        'https://x.com/' + artistData.username,
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
              } catch (e) {
                if (e instanceof Error) {
                  sendDiscordMessage(
                    e.name,
                    `${e.message}\n\n\`username: ${artist.username}\``,
                    'error'
                  );
                } else {
                  sendDiscordMessage('UnknownError', `${e}`, 'error');
                }
              }
            }
          );

          // Wait for all promises to complete
          await Promise.all(fetchAndCreatePromises);
        }

        await supabase.updateAnalyticsSuggestions(artistsSuggestions.length);
        sendDiscordMessage(
          'Artists suggestions',
          `Created ${artistsSuggestions.length} new artist suggestions`,
          'info'
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
