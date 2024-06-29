import { Profile, Scraper } from '@the-convocation/twitter-scraper';
import { getOriginalUrl } from '../utils';

export class TwitterService {
  private readonly scraper = new Scraper();

  async getTwitterProfile(username: string): Promise<Profile | undefined> {
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
      return undefined;
    }
  }
}

export async function test() {
  const t = new TwitterService();
  try {
    console.log(await t.getTwitterProfile('MortMort_'));
  } catch (e) {
    console.log(e);
  }
}
