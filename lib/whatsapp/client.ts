/**
 * Meta WhatsApp Cloud API Client
 * Handles outbound messaging and downloading incoming media attachments (screenshots).
 */

export interface WhatsAppClientConfig {
  accessToken?: string;
  phoneNumberId?: string;
}

export class WhatsAppClient {
  private configAccessToken?: string;
  private configPhoneNumberId?: string;
  private apiVersion = 'v21.0';

  constructor(config?: WhatsAppClientConfig) {
    this.configAccessToken = config?.accessToken;
    this.configPhoneNumberId = config?.phoneNumberId;
  }

  private get accessToken(): string {
    return (this.configAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  }

  private get phoneNumberId(): string {
    return (this.configPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  }

  /**
   * Sends a plain text message to a WhatsApp user.
   *
   * @param to - Recipient phone number (e.g. "+919876543210" or "919876543210")
   * @param text - Message text to send
   */
  async sendTextMessage(to: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.accessToken || !this.phoneNumberId) {
      console.warn('WhatsApp API credentials missing (WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID).');
      return { success: false, error: 'Credentials not configured' };
    }

    // Meta API expects digits only without leading '+'
    const cleanTo = to.replace(/\D/g, '');

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
          type: 'text',
          text: {
            preview_url: false,
            body: text,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Meta WhatsApp API error:', data);
        return { success: false, error: data.error?.message || 'Failed to send message' };
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
      };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Downloads a media attachment (e.g. payment screenshot) from Meta servers as base64.
   *
   * @param mediaId - The media ID received in the webhook payload.
   */
  async downloadMediaAsBase64(mediaId: string): Promise<{ base64: string; mimeType: string } | null> {
    if (!this.accessToken) {
      throw new Error('WHATSAPP_ACCESS_TOKEN is required to download media');
    }

    try {
      // Step 1: Retrieve media metadata and direct download URL
      const metaUrl = `https://graph.facebook.com/${this.apiVersion}/${mediaId}`;
      const metaRes = await fetch(metaUrl, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'User-Agent': 'curl/7.64.1',
        },
      });

      if (!metaRes.ok) {
        console.error(`Failed to get media url for ${mediaId}:`, await metaRes.text());
        return null;
      }

      const metaData = await metaRes.json();
      const downloadUrl = metaData.url;
      const mimeType = metaData.mime_type || 'image/jpeg';

      if (!downloadUrl) {
        return null;
      }

      // Step 2: Download the binary file using Bearer token with User-Agent
      const fileRes = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'User-Agent': 'curl/7.64.1',
        },
        redirect: 'follow',
      });

      if (!fileRes.ok) {
        console.error(`Failed to download binary file for ${mediaId}:`, await fileRes.text());
        return null;
      }

      const buffer = await fileRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      return { base64, mimeType };
    } catch (error) {
      console.error(`Error downloading WhatsApp media ${mediaId}:`, error);
      return null;
    }
  }
}

export const whatsappClient = new WhatsAppClient();
