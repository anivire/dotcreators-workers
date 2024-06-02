import { Artist, ArtistSuggestion, Prisma, PrismaClient } from '@prisma/client';
import { Profile } from '@the-convocation/twitter-scraper';

export class SupabaseService {
  private readonly prisma = new PrismaClient();

  async getArtistsSuggestions(): Promise<
    Omit<ArtistSuggestion, 'avatarUrl' | 'requestStatus'>[] | undefined
  > {
    try {
      let artistsSuggestions = await this.prisma.artistSuggestion.findMany({
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
      } else {
        return undefined;
      }
    } catch (e) {
      console.log('Error while trying to fetch artists suggestions list: ' + e);
      return undefined;
    }
  }

  async getArtistsProfilesPaginated(
    page: number
  ): Promise<{ data: Artist[]; hasNext: boolean } | undefined> {
    try {
      let limit = 50;
      let artistsProfiles = await this.prisma.artist.findMany({
        take: limit,
        skip: (page - 1) * limit,
      });

      if (artistsProfiles) {
        return {
          data: artistsProfiles,
          hasNext: artistsProfiles.length === limit ? true : false,
        };
      } else {
        return undefined;
      }
    } catch (e) {
      console.log('Error while trying to fetch artists profiles list: ' + e);
      return undefined;
    }
  }

  async createArtistInstance(artistData: Omit<Artist, 'id'>): Promise<boolean> {
    try {
      // Преобразование `images` в `InputJsonValue`
      const artistCreateInput: Prisma.ArtistCreateInput = {
        ...artistData,
        images: artistData.images as Prisma.InputJsonValue,
      };

      await this.prisma.artist.create({
        data: artistCreateInput,
      });

      return true;
    } catch (e) {
      console.log('Error while trying to create artist profile: ' + e);
      return false;
    }
  }

  async updateArtistProfiles(artistData: Profile[]) {
    try {
      let artistsProfileUpdate = artistData.map(async artist => {
        const last7DaysTrending = await this.prisma.artistTrending.findMany({
          where: {
            userId: artist.userId,
            recordedAt: {
              gte: new Date(new Date().setDate(new Date().getDate() - 7)),
            },
          },
          orderBy: {
            recordedAt: 'desc',
          },
        });

        let weeklyFollowersGrowingTrend = 0;
        let weeklyPostsGrowingTrend = 0;
        if (last7DaysTrending.length > 0) {
          const initialFollowersCount =
            last7DaysTrending[last7DaysTrending.length - 1]!.followersCount;
          const initialTweetsCount =
            last7DaysTrending[last7DaysTrending.length - 1]!.tweetsCount;
          const latestFollowersCount = artist.followersCount!;
          const latestTweetsCount = artist.tweetsCount!;

          if (initialFollowersCount > 0) {
            const followersDifference =
              latestFollowersCount - initialFollowersCount;
            weeklyFollowersGrowingTrend =
              (followersDifference / initialFollowersCount) * 100;
          }

          if (initialTweetsCount > 0) {
            const tweetsDifference = latestTweetsCount - initialTweetsCount;
            weeklyPostsGrowingTrend =
              (tweetsDifference / initialTweetsCount) * 100;
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
            weeklyFollowersGrowingTrend: parseFloat(
              weeklyFollowersGrowingTrend.toFixed(3)
            ),
            weeklyPostsGrowingTrend: parseFloat(
              weeklyPostsGrowingTrend.toFixed(3)
            ),
          },
        });
      });

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
      await Promise.all(artistsProfileUpdate);
      console.log('All artist profiles updated successfully');
    } catch (e) {
      console.log('Error while trying to update artist profiles: ' + e);
    }
  }

  async updateSuggestionRequestStatus(requestId: string, status: string) {
    try {
      this.prisma.artistSuggestion.update({
        where: {
          requestId: requestId,
        },
        data: {
          requestStatus: status,
        },
      });
    } catch (e) {
      console.log('Error while trying to update suggestion status: ' + e);
    }
  }
}
