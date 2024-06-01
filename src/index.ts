import cron from 'node-cron';
import { SupabaseService } from './supabaseService';
import { logger } from './utils';
import { TwitterService } from './twitterService';
import { Artist } from '@prisma/client';
import { Profile } from '@the-convocation/twitter-scraper';

const EVERY_HOURS = 24;
const supabase = new SupabaseService();
const twitter = new TwitterService();

cron.schedule(
  `0 0 */${EVERY_HOURS} * * *`,
  async () => {
    logger(`Start fetching suggested artists profiles...`);

    const artistsSuggestions = await supabase.getArtistsSuggestions();

    if (artistsSuggestions) {
      logger(
        `Recieved ${artistsSuggestions.length} artist suggestion(s), start fetching twitter data.`
      );

      artistsSuggestions.map(async (artist, index) => {
        logger(
          `[${index + 1}/${
            artistsSuggestions.length
          }] Start fetching twitter data for ${artist.username}...`
        );
        let artistData = await twitter.getTwitterProfile(artist.username);
        if (artistData) {
          logger(
            `[${index + 1}/${artistsSuggestions.length}] Data fetched for ${
              artist.username
            }, creating profile...`
          );
          let isProfileCreated = await supabase.createArtistInstance({
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
          });

          if (isProfileCreated) {
            logger(
              `[${index + 1}/${artistsSuggestions.length}] ${
                artist.username
              } profile is successfully created!`
            );
            await supabase.updateSuggestionRequestStatus(
              artist.requestId,
              'created'
            );
          } else {
            logger(
              `Unable to create profile for ${artist.username}, skipping...`
            );
          }
        } else {
          logger(`Unable to fetch data for ${artist.username}, skipping...`);
        }
      });
    } else {
      logger(`Unable to fetch profiles, skipping...`);
    }
  },
  {
    scheduled: true,
    name: 'Fetching suggested artists profiles.',
    runOnInit: true,
  }
);

cron.schedule(
  `0 0 */${EVERY_HOURS} * * *`,
  async () => {
    logger(`Start fetching artists profiles...`);
    let page = 1;
    let artistsNewData: Profile[] = [];
    let morePages = true;

    while (morePages) {
      const artistsProfiles = await supabase.getArtistsProfilesPaginated(page);

      if (artistsProfiles && artistsProfiles.data.length > 0) {
        for (const [index, artist] of artistsProfiles.data.entries()) {
          logger(
            `[${index + 1}/${
              artistsProfiles.data.length
            }] Start fetching twitter data for ${artist.username}...`
          );

          try {
            const artistData = await twitter.getTwitterProfile(artist.username);
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
        artistsNewData = [];
      } catch (error) {
        logger(`Error updating profiles: ${error}`);
      }
    } else {
      logger('No new artist data to update.');
    }

    // const artistsSuggestions = await supabase.getArtistsSuggestions();

    // if (artistsSuggestions) {
    //   logger(
    //     `Recieved ${artistsSuggestions.length} artist suggestion(s), start fetching twitter data.`
    //   );

    //   artistsSuggestions.map(async (artist, index) => {
    //     logger(
    //       `[${index + 1}/${
    //         artistsSuggestions.length
    //       }] Start fetching twitter data for ${artist.username}...`
    //     );
    //     let artistData = await twitter.getTwitterProfile(artist.username);
    //     if (artistData) {
    //       logger(`Data fetched for ${artist.username}, creating profile...`);
    //       let isProfileCreated = await supabase.createArtistInstance({
    //         tags: artist.tags,
    //         country: artist.country,
    //         bio: artistData.biography || null,
    //         followersCount: artistData.followersCount || 0,
    //         tweetsCount: artistData.tweetsCount || 0,
    //         images: {
    //           avatar: artistData.avatar || null,
    //           banner: artistData.banner || null,
    //         },
    //         name: artistData.name || null,
    //         url: artistData.url || 'https://x.com/' + artistData.username,
    //         website: artistData.website || null,
    //         joinedAt: new Date(artistData.joined!) || null,
    //         username: artistData.username!,
    //         userId: artistData.userId!,
    //         lastUpdatedAt: new Date(),
    //         createdAt: new Date(),
    //         weeklyFollowersGrowingTrend: 0,
    //         weeklyPostsGrowingTrend: 0,
    //       });

    //       if (isProfileCreated) {
    //         logger(`${artist.username} profile is successfully created!`);
    //         await supabase.updateSuggestionrequestStatus(
    //           artist.requestId,
    //           'created'
    //         );
    //       } else {
    //         logger(
    //           `Unable to create profile for ${artist.username}, skipping...`
    //         );
    //       }
    //     } else {
    //       logger(`Unable to fetch data for ${artist.username}, skipping...`);
    //     }
    //   });
    // } else {
    //   logger(`Unable to fetch profiles, skipping...`);
    // }
  },
  {
    scheduled: true,
    name: 'Update followers and tweets count for artists (pfp/banner/bio and etc).',
    runOnInit: true,
  }
);
