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
        // // Получаем предыдущие записи по подписчикам
        // const previousTrending = await this.prisma.artistTrending.findFirst({
        //   where: { userId: artist.userId },
        //   orderBy: { recordedAt: 'desc' },
        // });

        // // Рассчитываем тренд роста подписчиков за неделю
        // let weeklyFollowersGrowingTrend = 0;
        // if (previousTrending) {
        //   const previousFollowersCount = previousTrending.followersCount;
        //   const followersDifference =
        //     artist.followersCount! - previousFollowersCount;
        //   weeklyFollowersGrowingTrend =
        //     (followersDifference / previousFollowersCount) * 100;
        // }

        // Обновляем данные артиста
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
            lastUpdatedAt: new Date(),
            url: artist.url,
            // weeklyFollowersGrowingTrend: weeklyFollowersGrowingTrend,
          },
        });
      });

      let createArtistTrend = artistData.map(artist => {
        return this.prisma.artistTrending.create({
          data: {
            followersCount: artist.followersCount!,
            tweetsCount: artist.tweetsCount!,
            recordedAt: new Date(),
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
