import { Artist, ArtistSuggestion, Prisma, PrismaClient } from '@prisma/client';
import { Profile } from '@the-convocation/twitter-scraper';

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
      // Преобразование `images` в `InputJsonValue`
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

  async updateArtistProfiles(artistData: Profile[]) {
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

      let artistsProfileUpdate = artistData.map(async artist => {
        const last7DaysTrending = await this.prisma.artistTrending.findMany({
          where: {
            userId: artist.userId,
          },
          orderBy: {
            recordedAt: 'desc',
          },
          take: 7,
        });

        let growthTrend: {
          followers?: number;
          posts?: number;
        } = {};

        if (last7DaysTrending.length >= 6) {
          growthTrend.followers = 0;
          growthTrend.posts = 0;

          const initialTrendIsExists =
            last7DaysTrending[last7DaysTrending.length - 1];
          const initialTrend = last7DaysTrending[6];
          const latestTrend = last7DaysTrending[0];

          if (
            initialTrendIsExists &&
            artist.followersCount != null &&
            artist.tweetsCount != null &&
            initialTrend &&
            latestTrend
          ) {
            const initialFollowersCount = initialTrend.followersCount;
            const initialTweetsCount = initialTrend.tweetsCount;
            const latestFollowersCount = latestTrend.followersCount;
            const latestTweetsCount = latestTrend.tweetsCount;

            if (initialFollowersCount > 0) {
              const followersDifference =
                latestFollowersCount - initialFollowersCount;
              growthTrend.followers =
                (followersDifference / initialFollowersCount) * 100;
            }

            if (initialTweetsCount > 0) {
              const tweetsDifference = latestTweetsCount - initialTweetsCount;
              growthTrend.posts = (tweetsDifference / initialTweetsCount) * 100;
            }
          }
        }

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
            weeklyFollowersGrowingTrend: growthTrend.followers
              ? Number.parseFloat(growthTrend.followers.toFixed(3))
              : 0,
            weeklyPostsGrowingTrend: growthTrend.posts
              ? Number.parseFloat(growthTrend.posts.toFixed(3))
              : 0,
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
