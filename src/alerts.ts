import { config } from './config.js';

export async function alert(message: string): Promise<void> {
  console.log(`🔔 ${message}`);
  if (!config.telegramBotToken || !config.telegramChatId) return;
  try {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: config.telegramChatId, text: message, disable_web_page_preview: true }),
    });
  } catch (error) {
    console.warn('Telegram alert failed', error);
  }
}
