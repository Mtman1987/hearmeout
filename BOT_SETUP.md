# Bot & App Setup Guide

This guide details how to get credentials for the HearMeOut Firebase backend, Twitch bot, Discord bot, and LiveKit voice chat.

## 1. Firebase Service Account

The bots use the Firebase Admin SDK to securely interact with your Firestore database from a server environment. This requires a **Service Account Key**.

### Creating the Service Account Key:

1.  **Open the Google Cloud Console** for your Firebase project. You can find a link to this in your Firebase project settings under the "Service accounts" tab. A quick link is:
    `https://console.cloud.google.com/iam-admin/serviceaccounts?project=studio-4331919473-dea24`

2.  **Select your project** if prompted.

3.  Click on the service account with the `Firebase Admin SDK` role (it usually looks like `firebase-adminsdk-...@...gserviceaccount.com`).

4.  Go to the **"Keys"** tab.

5.  Click **"Add Key"** -> **"Create new key"**.

6.  Choose **JSON** as the key type and click **"Create"**.

7.  A JSON file will be downloaded to your computer. **Treat this file like a password!** Do not share it or commit it to your git repository.

### Using the Service Account Key:

1.  Place the downloaded JSON file somewhere safe **outside** of your project directory.
2.  In your `.env` file, set the `GOOGLE_APPLICATION_CREDENTIALS` variable to the **absolute path** of that downloaded JSON file.

    For example:
    -   On macOS/Linux: `GOOGLE_APPLICATION_CREDENTIALS="/Users/yourname/Documents/keys/my-project-key.json"`
    -   On Windows: `GOOGLE_APPLICATION_CREDENTIALS="C:\\Users\\yourname\\Documents\\keys\\my-project-key.json"`

This variable allows all server-side parts of your application (including the bots and API routes) to securely connect to Firebase.

## 2. Common Bot Configuration

Both the Twitch and Discord bots need to know which HearMeOut room to add songs to.

-   `TARGET_ROOM_ID`: The ID of the HearMeOut room you want the bots to add songs to. You can get this from the URL when you are in a room (e.g., `.../rooms/<this_is_the_id>`).

## 3. Twitch Bot Credentials

In your `.env` file, you need to fill in the following values:

-   `TWITCH_BOT_USERNAME`: The Twitch username of your bot account.
-   `TWITCH_BOT_OAUTH_TOKEN`: The OAuth token for your bot. You can generate one at [https://twitchapps.com/tmi/](https://twitchapps.com/tmi/). Make sure to include the `oauth:` prefix.
-   `TWITCH_CHANNEL_NAME`: The name of the Twitch channel you want the bot to join (e.g., your own channel name).

Once these are set up, you can run the bot in a separate terminal with `npm run twitch-bot`.

## 4. Discord Bot Credentials

To enable Discord integration, you need to create a Discord Application and add a Bot user to it.

### Creating the Discord Bot:

1.  **Go to the Discord Developer Portal:** [https://discord.com/developers/applications](https://discord.com/developers/applications)
2.  Click **"New Application"** in the top right corner and give it a name (e.g., "HearMeOut Bot").
3.  On the application's main page, you will find the **Application ID** (also called Client ID) and the **Public Key**. You will need both of these.
4.  Navigate to the **"Bot"** tab on the left.
5.  Click **"Add Bot"** and confirm.

### Adding Credentials to `.env`:

1.  Go back to the **"General Information"** page on the developer portal. Copy the **"APPLICATION ID"** and paste it as the value for `DISCORD_CLIENT_ID` in your `.env` file.
2.  On the same page, copy the **"PUBLIC KEY"** and paste it as the value for `DISCORD_PUBLIC_KEY` in your `.env` file.
3.  Navigate to the **"Bot"** tab. Under the bot's username, click **"Reset Token"** and confirm.
4.  **Copy the token immediately.** This is a secret, treat it like a password!
5.  In your `.env` file, paste this token as the value for `DISCORD_BOT_TOKEN`.

### Inviting the Bot to Your Server:

1.  Go to the **"OAuth2" -> "URL Generator"** tab.
2.  In the "Scopes" section, check the `bot` box.
3.  A new "Bot Permissions" section will appear below. Check the following permissions:
    *   `Send Messages`
    *   `Read Message History`
4.  Scroll down and copy the **Generated URL**.
5.  Paste this URL into your browser, select the server you want to add the bot to, and click **"Authorize"**.

### Getting the Channel ID:

1.  In your Discord client, go to **User Settings -> Advanced**.
2.  Enable **"Developer Mode"**.
3.  Go to the channel in your server where you want the bot to post messages.
4.  Right-click on the channel name in the channel list and click **"Copy Channel ID"**.
5.  In your `.env` file, paste this ID as the value for `DISCORD_CHANNEL_ID`.

## 5. LiveKit Credentials (for Voice Chat)

The voice chat rooms are powered by LiveKit. You need to create a free LiveKit Cloud account and get API keys.

1.  **Go to LiveKit Cloud:** [https://cloud.livekit.io/](https://cloud.livekit.io/) and sign up or log in.
2.  Create a new project if you don't have one already.
3.  In your project's dashboard, go to **Settings**.
4.  Under the "API Keys" section, you will find your **API Key** and **API Secret**.
5.  Under "General", you will find the **WebSocket URL**.

### Adding Credentials to `.env`:

-   `NEXT_PUBLIC_LIVEKIT_URL`: Paste the **WebSocket URL** here.
-   `LIVEKIT_API_KEY`: Paste the **API Key** here.
-   `LIVEKIT_API_SECRET`: Paste the **API Secret** here.
