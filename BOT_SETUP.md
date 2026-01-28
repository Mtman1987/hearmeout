# Bot Setup Guide

To run the Twitch and Discord bots, you need to provide them with secure credentials to access your Firebase project and the respective services.

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

## 2. Twitch Bot Credentials

In your `.env` file, you need to fill in the following values:

-   `TWITCH_BOT_USERNAME`: The Twitch username of your bot account.
-   `TWITCH_BOT_OAUTH_TOKEN`: The OAuth token for your bot. You can generate one at [https://twitchapps.com/tmi/](https://twitchapps.com/tmi/). Make sure to include the `oauth:` prefix.
-   `TWITCH_CHANNEL_NAME`: The name of the Twitch channel you want the bot to join (e.g., your own channel name).
-   `TARGET_ROOM_ID`: The ID of the HearMeOut room you want the bot to add songs to. You can get this from the URL when you are in a room (e.g., `.../rooms/<this_is_the_id>`).

Once these are set up, you can run the bot in a separate terminal with `npm run twitch-bot`.
