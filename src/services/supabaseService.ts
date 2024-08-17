import { Artist, ArtistSuggestion, Prisma, PrismaClient } from '@prisma/client';
import { Profile } from '@the-convocation/twitter-scraper';
import { logger } from '../utils';

export class SupabaseService {
  private readonly prisma = new PrismaClient();

  async getArtistsSuggestions(): Promise<
    Omit<ArtistSuggestion, 'avatarUrl' | 'requestStatus'>[] | undefined
  > {
    try {
      const artistsSuggestions = await this.prisma.artistSuggestion.findMany({
        where: {
          requestStatus: 'approved',
        },
        select: {
          requestId: true,
          createdAt: true,
          username: true,
          country: true,
          tags: true,
        },
      });

      if (artistsSuggestions) {
        return artistsSuggestions;
      }
      return undefined;
    } catch (e) {
      console.log(`Error while trying to fetch artists suggestions list: ${e}`);
      return undefined;
    }
  }

  async getArtistsProfilesPaginated(
    page: number
  ): Promise<{ data: Artist[]; hasNext: boolean } | undefined> {
    try {
      const limit = 50;
      const artistsProfiles = await this.prisma.artist.findMany({
        take: limit,
        skip: (page - 1) * limit,
      });

      if (artistsProfiles) {
        return {
          data: artistsProfiles,
          hasNext: artistsProfiles.length === limit,
        };
      }
      return undefined;
    } catch (e) {
      console.log(`Error while trying to fetch artists profiles list: ${e}`);
      return undefined;
    }
  }

  async createArtistInstance(
    artistData: Omit<Artist, 'id'>,
    requestId: string
  ): Promise<boolean> {
    try {
      // Transform `images` in `InputJsonValue`
      const artistCreateInput: Prisma.ArtistCreateInput = {
        ...artistData,
        images: artistData.images as Prisma.InputJsonValue,
      };

      await this.prisma.$transaction(async prisma => {
        await prisma.artist.create({
          data: artistCreateInput,
        });

        await prisma.artistSuggestion.update({
          where: {
            requestId: requestId,
          },
          data: {
            requestStatus: 'created',
          },
        });
      });

      return true;
    } catch (e) {
      console.log(`Error while trying to create artist profile: ${e}`);
      return false;
    }
  }

  async updateArtistsTrendPercent() {
    try {
      let page = 1;
      let artistData: Artist[] = [];
      let morePages = true;

      logger(`Start artist profiles for update trending percent...`);

      while (morePages) {
        const recievedProfiles = await this.getArtistsProfilesPaginated(page);

        if (
          recievedProfiles &&
          recievedProfiles.data &&
          recievedProfiles.data.length > 0
        ) {
          logger(
            `Recieved ${recievedProfiles.data.length} artist profiles, merging...`
          );
          artistData = artistData.concat(recievedProfiles.data);

          page++;
        } else {
          morePages = false;
        }
      }

      logger(
        `Recieved total ${artistData.length} artist profiles, updating trend percent...`
      );

      let updateProfilePromises = artistData.map(async artist => {
        logger(`Updating trend for ${artist.userId}@${artist.username}`);

        const weeklyTrends = await this.prisma.artistTrending.findMany({
          where: {
            userId: artist.userId,
          },
          orderBy: {
            recordedAt: 'desc',
          },
          take: 7,
        });

        let growthTrend: {
          followers: number;
          posts: number;
        } = { followers: 0, posts: 0 };

        // Update weekly trend percent
        if (weeklyTrends.length >= 7) {
          const initialTrendData = weeklyTrends[6];
          const latestTrendData = weeklyTrends[0];

          if (
            artist.followersCount != null &&
            artist.tweetsCount != null &&
            initialTrendData &&
            latestTrendData
          ) {
            const initialTrend = {
              followers: initialTrendData.followersCount,
              tweets: initialTrendData.tweetsCount,
            };

            const latestTrend = {
              followers: latestTrendData.followersCount,
              tweets: latestTrendData.tweetsCount,
            };

            const followersDifference =
              latestTrend.followers - initialTrend.followers;
            growthTrend.followers =
              (followersDifference / initialTrend.followers) * 100;

            const tweetsDifference = latestTrend.tweets - initialTrend.tweets;
            growthTrend.posts = (tweetsDifference / initialTrend.tweets) * 100;
          }
        }

        return this.prisma.artist.update({
          where: { userId: artist.userId },
          data: {
            lastUpdatedAt: new Date().toISOString(),
            weeklyFollowersGrowingTrend: Number.parseFloat(
              growthTrend.followers.toFixed(3)
            ),
            weeklyPostsGrowingTrend: Number.parseFloat(
              growthTrend.posts.toFixed(3)
            ),
          },
        });
      });

      await Promise.all(updateProfilePromises);
      console.log('All artist trends percent data updated successfully');
    } catch (e) {
      console.log(`Error while trying to update artist trends: ${e}`);
    }
  }

  async createArtistTrends(artistData: Profile[]) {
    try {
      let createArtistTrend = artistData.map(artist => {
        return this.prisma.artistTrending.create({
          data: {
            followersCount: artist.followersCount!,
            tweetsCount: artist.tweetsCount!,
            recordedAt: new Date().toISOString(),
            userId: artist.userId!,
          },
        });
      });

      await Promise.all(createArtistTrend);
      console.log('Succesfully created new artist trends entries');
    } catch (e) {
      console.log(
        `Error while trying to create new artist trends entries: ${e}`
      );
    }
  }

  async updateArtistProfiles(artistData: Profile[]) {
    try {
      let artistsProfileUpdate = artistData.map(async artist => {
        return this.prisma.artist.update({
          where: { userId: artist.userId },
          data: {
            followersCount: artist.followersCount,
            tweetsCount: artist.tweetsCount,
            images: {
              avatar: artist.avatar,
              banner: artist.banner,
            },
            bio: artist.biography,
            website: artist.website,
            name: artist.name,
            lastUpdatedAt: new Date().toISOString(),
            url: artist.url,
          },
        });
      });

      await Promise.all(artistsProfileUpdate);
      console.log('All artist profiles updated successfully');
    } catch (e) {
      console.log(`Error while trying to update artist profiles: ${e}`);
    }
  }

  async updateAnalyticsArtists(totalArtists: number) {
    try {
      const totalArtistsRequest = await this.prisma.analyticsArtists.create({
        data: {
          totalArtistsCount: totalArtists,
        },
      });

      if (totalArtistsRequest) {
        console.log('Artists analytics records successfully created');
      }
    } catch (e) {
      console.log(`Error while trying to create analytics records: ${e}`);
    }
  }

  async updateAnalyticsSuggestions(totalSuggestions: number) {
    try {
      const totalSuggestionsRequest =
        await this.prisma.analyticsSuggestions.create({
          data: {
            totalSuggestionsCount: totalSuggestions ?? 0,
          },
        });

      if (totalSuggestionsRequest) {
        console.log('Suggestions analytics records successfully created');
      }
    } catch (e) {
      console.log(`Error while trying to create analytics records: ${e}`);
    }
  }
}
