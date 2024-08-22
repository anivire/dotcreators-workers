import { Profile, Scraper } from '@the-convocation/twitter-scraper';
import { formatBio, getOriginalUrl } from '../utils';
import { sendDiscordMessage } from './webhookService';
import { TwitterOpenApi } from 'twitter-openapi-typescript';
import { ParsedProfile } from '../models/ParsedProfile';

export class TwitterService {
  private readonly scraper = new Scraper();
  private readonly api = new TwitterOpenApi();

  async getTwitterProfileLegacy(
    username: string
  ): Promise<Profile | undefined> {
    try {
      let profile = await this.scraper.getProfile(username);

      if (profile.biography) {
        const regex =
          /https?:\/\/(?:www\.|(?!www))[^\s.]+(?:\.[^\s.]+)+(?:\w\/?)*/gi;

        const matches = profile.biography.match(regex);

        if (matches) {
          const promises = matches.map(async link => {
            const originalUrl = await getOriginalUrl(link);
            return originalUrl || '';
          });

          const newBioArray = await Promise.all(promises);

          let index = 0;
          const processedBio = profile.biography.replace(
            regex,
            () => newBioArray[index++] || ''
          );

          profile.biography = processedBio;
        }
      }

      return profile;
    } catch (e) {
      console.log(e);

      if (e instanceof Error) {
        sendDiscordMessage(
          e.name,
          `${e.message}\n\n\`username: ${username}\``,
          'error'
        );
      } else {
        sendDiscordMessage('UnknownError', `${e}`, 'error');
      }
      return undefined;
    }
  }

  async getTwitterProfileByUsername(username: string) {
    const twitterClient = await this.api.getGuestClient();
    const r = await twitterClient
      .getUserApi()
      .getUserByScreenName({ screenName: username });

    if (r && r.data && r.data.user) {
      const profile: ParsedProfile = {
        userId: r.data.user.restId,
        username: r.data.user.legacy.screenName,
        followersCount: r.data.user.legacy.normalFollowersCount,
        tweetsCount: r.data.user.legacy.statusesCount,
        url: `https://x.com/${r.data.user.legacy.screenName}`,
        avatarUrl: r.data.user.legacy.profileImageUrlHttps.replace(
          '_normal',
          ''
        ),
        bannerUrl: r.data.user.legacy.profileBannerUrl,
        displayName: r.data.user.legacy.name,
        biography: await formatBio(r.data.user.legacy.description),
        website: r.data.user.legacy.entities.url
          ? r.data.user.legacy.entities.url.urls[0].expanded_url
          : null,
        createdAt: new Date(r.data.user.legacy.createdAt).toISOString(),
      };

      return profile;
    }
  }

  async getTwitterProfileById(userId: string) {
    const twitterClient = await this.api.getGuestClient();
    const r = await twitterClient
      .getUserApi()
      .getUserByRestId({ userId: userId });

    if (r && r.data && r.data.user) {
      const profile: ParsedProfile = {
        userId: r.data.user.restId,
        username: r.data.user.legacy.screenName,
        followersCount: r.data.user.legacy.normalFollowersCount,
        tweetsCount: r.data.user.legacy.statusesCount,
        url: `https://x.com/${r.data.user.legacy.screenName}`,
        avatarUrl: r.data.user.legacy.profileImageUrlHttps.replace(
          '_normal',
          ''
        ),
        bannerUrl: r.data.user.legacy.profileBannerUrl,
        displayName: r.data.user.legacy.name,
        biography: await formatBio(r.data.user.legacy.description),
        website: r.data.user.legacy.entities.url
          ? r.data.user.legacy.entities.url.urls[0].expanded_url
          : null,
        createdAt: new Date(r.data.user.legacy.createdAt).toISOString(),
      };

      return profile;
    }
  }
}
