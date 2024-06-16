export function logger(text: string) {
  console.log(
    `[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}] ${text}`
  );
}

export async function getOriginalUrl(shortenedUrl: string): Promise<string> {
  try {
    const response = await fetch(shortenedUrl, {
      method: 'HEAD',
      redirect: 'manual',
    });

    if (response.headers && response.headers.get('location')) {
      return response.headers.get('location')!;
    } else {
      console.log('No location header found in response.');
      return shortenedUrl;
    }
  } catch (error) {
    console.error('Error fetching original URL:', error);
    return shortenedUrl;
  }
}
