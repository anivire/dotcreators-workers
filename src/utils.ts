export function logger(text: string) {
  console.log(
    `[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}] ${text}`
  );
}
