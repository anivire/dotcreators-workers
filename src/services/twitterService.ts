import { Profile, Scraper } from '@the-convocation/twitter-scraper';

export class TwitterService {
  private readonly scraper = new Scraper();

  async getTwitterProfile(username: string): Promise<Profile> {
    return await this.scraper.getProfile(username);
  }
}
